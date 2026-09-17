#!/usr/bin/env python3
"""Install the declared skills into OMP's own agent directory.

OMP is the single owner of skills: it discovers them natively from
`<agent-dir>/skills` (highest priority) and also reads `.agents/skills` through
its compatibility provider. Installing there means one place to look and nothing
to vendor into a repository — the skill bodies come from their upstreams at a
pinned commit, recorded in `skills.lock`, and are never committed here.

Operations:
  install   fetch every declared source and install the selected skills
  check     report what is missing or stale in the agent directory
  update    fetch candidates into a staging directory for review

The declaration (`skills-enabled.json`, `skills.lock`) lives in this repository;
the installed skill bodies live in OMP's agent directory. That split is the
point: this repo states *what* the environment contains, OMP holds the content.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SKILL_NAME = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')


def default_agent_skills():
    """OMP's active agent directory, honouring the profile and env overrides."""
    override = os.environ.get('PI_CODING_AGENT_DIR')
    if override:
        return Path(override) / 'skills'
    profile = os.environ.get('OMP_PROFILE') or os.environ.get('PI_PROFILE')
    root = Path(os.environ.get('PI_CONFIG_DIR', '.omp'))
    base = Path.home() / root
    if profile and profile.strip() and profile.strip() != 'default':
        return base / 'profiles' / profile.strip() / 'agent' / 'skills'
    return base / 'agent' / 'skills'


def fetch_failure(exc):
    """A diagnosis the operator can act on, without echoing credentials."""
    if isinstance(exc, subprocess.TimeoutExpired):
        return f'git timed out after {exc.timeout}s'
    if isinstance(exc, subprocess.CalledProcessError):
        stderr = (exc.stderr or '')
        if isinstance(stderr, bytes):
            stderr = stderr.decode('utf-8', 'replace')
        detail = stderr.strip().splitlines()
        return f'git exited {exc.returncode}: {detail[-1] if detail else "no output"}'
    return 'local filesystem or Git executable unavailable; check permissions, disk space, and Git installation'


def declared_sources(repo):
    lock = repo / '.agents' / 'skills.lock'
    sources = json.loads(lock.read_text())['sources']
    if not isinstance(sources, dict) or not sources:
        raise ValueError('skills.lock must declare at least one source')
    return sources


def enabled_names(repo):
    names = json.loads((repo / '.agents' / 'skills-enabled.json').read_text())
    if not isinstance(names, list) or any(not isinstance(n, str) or not SKILL_NAME.fullmatch(n) for n in names):
        raise ValueError('skills-enabled.json must be a list of skill directory names')
    if len(names) != len(set(names)):
        raise ValueError('Duplicate enabled skill names')
    return set(names)


def fetch_source(source, scratch, timeout=120):
    """Clone one declared source at its pin and return the checkout path."""
    checkout = Path(scratch) / 'checkout'
    url = source['url']
    revision = source.get('commit')
    env = {**os.environ, 'GIT_TERMINAL_PROMPT': '0'}
    subprocess.run(['git', 'clone', '--depth', '1', '--', url, str(checkout)],
                   check=True, capture_output=True, text=True, timeout=timeout, env=env)
    if revision:
        # The pin is what makes an install reproducible. A shallow clone cannot
        # fetch an abbreviated revision (`couldn't find remote ref`), so deepen
        # until the pin exists rather than silently installing HEAD instead.
        def pinned():
            return subprocess.run(['git', '-C', str(checkout), 'cat-file', '-e', f'{revision}^{{commit}}'],
                                  capture_output=True, text=True).returncode == 0
        if not pinned():
            subprocess.run(['git', '-C', str(checkout), 'fetch', '--unshallow', 'origin'],
                           capture_output=True, text=True, timeout=timeout, env=env)
        if not pinned():
            raise ValueError(f'pinned revision {revision} not found in {url}')
        subprocess.run(['git', '-C', str(checkout), 'checkout', '--detach', revision],
                       check=True, capture_output=True, text=True, timeout=timeout, env=env)
    return checkout


def source_skill_dirs(checkout, source):
    """Map skill name -> source directory for one checked-out source."""
    relative = Path(source['path'])
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError(f"Invalid source path for {source.get('url')}")
    base = checkout / relative
    found = {}
    for skill_md in base.rglob('SKILL.md'):
        found.setdefault(skill_md.parent.name, skill_md.parent)
    return found


def install(repo, target, dry_run=False):
    """Install every declared skill into the agent directory from its upstream."""
    sources = declared_sources(repo)
    enabled = enabled_names(repo)
    installed, skipped, errors = [], [], []
    target.mkdir(parents=True, exist_ok=True)
    for name, source in sources.items():
        if 'install' in source:
            skipped.append(f'{name}: tool-managed, not installed as a skill')
            continue
        try:
            with tempfile.TemporaryDirectory(prefix='caret-skill-fetch-') as scratch:
                checkout = fetch_source(source, scratch)
                available = source_skill_dirs(checkout, source)
                for skill in source.get('skills', []):
                    if not SKILL_NAME.fullmatch(skill):
                        raise ValueError(f'invalid skill name: {skill}')
                    if skill not in enabled:
                        continue
                    source_dir = available.get(skill)
                    if source_dir is None:
                        errors.append(f'{name}/{skill}: not present at the pinned revision')
                        continue
                    destination = target / skill
                    if dry_run:
                        installed.append(f'{skill} (dry run)')
                        continue
                    if destination.exists() or destination.is_symlink():
                        if destination.is_symlink():
                            destination.unlink()
                        else:
                            shutil.rmtree(destination)
                    shutil.copytree(source_dir, destination, symlinks=True)
                    installed.append(skill)
        except (OSError, subprocess.SubprocessError, ValueError, KeyError) as exc:
            errors.append(f'{name}: {fetch_failure(exc)}')
    return installed, skipped, errors


def check(repo, target):
    """Report declared skills that are missing from the agent directory."""
    enabled = enabled_names(repo)
    declared = set()
    for source in declared_sources(repo).values():
        if 'install' in source:
            continue
        declared.update(s for s in source.get('skills', []) if s in enabled)
    missing = sorted(s for s in declared if not (target / s / 'SKILL.md').is_file())
    for skill in missing:
        print(f'Missing from {target}: {skill}')
    print(f'{len(declared) - len(missing)}/{len(declared)} declared skills installed in {target}')
    return not missing


def stage_updates(repo, timeout=60):
    """Fetch declared sources into a review directory; install nothing."""
    sources = declared_sources(repo)
    staging = repo / '.agents' / 'skill-updates'
    staging.mkdir(parents=True, exist_ok=True)
    destination = Path(tempfile.mkdtemp(prefix='review-', dir=staging))
    manifest = {'purpose': 'Review candidates only; installed skills and skills.lock are unchanged',
                'sources': {}, 'errors': []}
    for name, source in sources.items():
        entry = {}; manifest['sources'][name] = entry
        if 'install' in source:
            entry['status'] = 'tool-managed; not updated by skill staging'
            continue
        label = name.replace('/', '--')
        if not re.fullmatch(r'[A-Za-z0-9_.-]+', label):
            raise ValueError(f'Invalid source name: {name}')
        try:
            with tempfile.TemporaryDirectory(prefix='caret-skill-fetch-') as scratch:
                checkout = fetch_source(source, scratch, timeout)
                entry['commit'] = subprocess.check_output(
                    ['git', '-C', str(checkout), 'rev-parse', 'HEAD'], text=True,
                    stderr=subprocess.PIPE, timeout=timeout).strip()
                available = source_skill_dirs(checkout, source)
                entry['skills'] = []
                for skill in source.get('skills', []):
                    if not SKILL_NAME.fullmatch(skill):
                        raise ValueError(f'invalid skill name: {skill}')
                    source_dir = available.get(skill)
                    if source_dir is None:
                        raise ValueError(f'{skill}: not present at the fetched revision')
                    shutil.copytree(source_dir, destination / label / skill, symlinks=True)
                    entry['skills'].append(skill)
                entry['status'] = 'staged for review'
        except (OSError, subprocess.SubprocessError, ValueError) as exc:
            entry['status'] = 'failed'
            entry['reason'] = fetch_failure(exc)
            manifest['errors'].append(f"{name}: {entry['reason']}")
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return destination, manifest['errors']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['install', 'check', 'update'])
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--target', type=Path, default=default_agent_skills(),
                        help="OMP's agent skills directory (default: the active agent dir)")
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    try:
        if args.operation == 'install':
            installed, skipped, errors = install(args.repo.resolve(), args.target, args.dry_run)
            verb = 'Would install' if args.dry_run else 'Installed'
            print(f'{verb} {len(installed)} skill(s) into {args.target}')
            for note in skipped:
                print(f'Skipped {note}')
            for error in errors:
                print(f'Incomplete: {error}')
            return 1 if errors else 0
        if args.operation == 'check':
            return 0 if check(args.repo.resolve(), args.target) else 1
        destination, errors = stage_updates(args.repo.resolve())
        print(f'Upstream review candidates: {destination}')
        print('Installed skills and skills.lock were not changed. Review, then update skills.lock.')
        for error in errors:
            print(f'Fetch incomplete: {error}; see manifest.json')
        return 1 if errors else 0
    except (OSError, ValueError, KeyError) as exc:
        print(f'Skill maintenance failed: {exc}')
        return 1


if __name__ == '__main__':
    sys.exit(main())
