# Caret — Source coverage ledger

ตรวจ 9 กันยายน 2026 • ดึง Markdown จาก Cursor public index 148 URLs สำเร็จ; ตัวเลขนี้คือ retrieval coverage ไม่ใช่จำนวนฟีเจอร์หรือผลทดสอบ

แต่ละ URL ถูกจัดเข้าหมวด requirement แล้ว ระดับ `body-reviewed` หมายถึงอ่านเนื้อหาสำคัญสำหรับแผน; `indexed` หมายถึงดึง/จัดหมวด/สำรวจหัวข้อ แต่ยังไม่ได้ตรวจทุก field หรือ endpoint รายละเอียด ใน implementation จะต้องตรวจ schema ของ version ที่เลือกโดยตรง

Raw research อยู่ใน temporary cache ไม่คัดลอกบทความเต็มเข้ามาในโปรเจกต์ Hash คือ SHA-256 ของ Markdown ที่ดึง ใช้ชี้การเปลี่ยนเอกสาร ไม่ใช่การยืนยันความถูกต้องของข้อความ

## Cursor docs index

ที่มา: [Cursor llms index](https://cursor.com/llms.txt) • เอกสารหลัก [Cursor docs](https://cursor.com/docs)

| Source ID | URL | Requirement families | ระดับตรวจ | Content hash |
|---|---|---|---|---|
| SRC-001 | [https://cursor.com/docs.md](https://cursor.com/docs.md) | OVERVIEW | indexed | `2fdd0c97657df1c0` |
| SRC-002 | [account/enterprise/billing-groups.md](https://cursor.com/docs/account/enterprise/billing-groups.md) | API/ADM | indexed | `984b0c63455a3318` |
| SRC-003 | [account/enterprise/cyber-safeguards.md](https://cursor.com/docs/account/enterprise/cyber-safeguards.md) | API/ADM | indexed | `0e7b18545e2358af` |
| SRC-004 | [account/enterprise/service-accounts.md](https://cursor.com/docs/account/enterprise/service-accounts.md) | API/ADM | indexed | `900f315460955cf5` |
| SRC-005 | [account/organizations/organization-admin-api.md](https://cursor.com/docs/account/organizations/organization-admin-api.md) | API/ADM | indexed | `bcc650e9967b34f1` |
| SRC-006 | [account/teams/admin-api.md](https://cursor.com/docs/account/teams/admin-api.md) | API/ADM | indexed | `6c30957713a5606f` |
| SRC-007 | [account/teams/ai-code-tracking-api.md](https://cursor.com/docs/account/teams/ai-code-tracking-api.md) | API/ADM | indexed | `d27c0fe9a13b3464` |
| SRC-008 | [account/teams/analytics-api.md](https://cursor.com/docs/account/teams/analytics-api.md) | API/ADM | indexed | `469f2fd7b96e9059` |
| SRC-009 | [account/teams/analytics.md](https://cursor.com/docs/account/teams/analytics.md) | API/ADM | indexed | `98ddd0625c61468f` |
| SRC-010 | [account/teams/dashboard.md](https://cursor.com/docs/account/teams/dashboard.md) | API/ADM | indexed | `4ef63a87d70f2bd1` |
| SRC-011 | [account/teams/members.md](https://cursor.com/docs/account/teams/members.md) | API/ADM | indexed | `36801c29d995835a` |
| SRC-012 | [account/teams/pricing.md](https://cursor.com/docs/account/teams/pricing.md) | API/ADM | indexed | `1fb83fcb43db4871` |
| SRC-013 | [account/teams/scim.md](https://cursor.com/docs/account/teams/scim.md) | API/ADM | indexed | `00ea2f733874db15` |
| SRC-014 | [account/teams/setup.md](https://cursor.com/docs/account/teams/setup.md) | API/ADM | indexed | `88c7e2ca56033bc5` |
| SRC-015 | [account/teams/sso.md](https://cursor.com/docs/account/teams/sso.md) | API/ADM | indexed | `d72bcc572c84a0fd` |
| SRC-016 | [agent/agent-review.md](https://cursor.com/docs/agent/agent-review.md) | REV | body-reviewed | `3715e5c3d9d013fd` |
| SRC-017 | [agent/agents-window.md](https://cursor.com/docs/agent/agents-window.md) | AG | body-reviewed | `3f4b7efbc8aa1238` |
| SRC-018 | [agent/debug-mode.md](https://cursor.com/docs/agent/debug-mode.md) | MOD | body-reviewed | `e034de33e0c42c44` |
| SRC-019 | [agent/design-mode.md](https://cursor.com/docs/agent/design-mode.md) | VIS | body-reviewed | `6335b0674fa82baa` |
| SRC-020 | [agent/overview.md](https://cursor.com/docs/agent/overview.md) | AG | body-reviewed | `6fc55bfd04299e85` |
| SRC-021 | [agent/plan-mode.md](https://cursor.com/docs/agent/plan-mode.md) | MOD | body-reviewed | `c0d81d9373fbe024` |
| SRC-022 | [agent/prompting.md](https://cursor.com/docs/agent/prompting.md) | CTX | body-reviewed | `438f77bf7295d280` |
| SRC-023 | [agent/security.md](https://cursor.com/docs/agent/security.md) | SAFE | indexed | `d54ccd9897c20d5c` |
| SRC-024 | [agent/security/run-modes.md](https://cursor.com/docs/agent/security/run-modes.md) | SAFE | indexed | `556b501c270e1f90` |
| SRC-025 | [agent/tools/browser.md](https://cursor.com/docs/agent/tools/browser.md) | VIS | indexed | `bdd6f305af999c70` |
| SRC-026 | [agent/tools/canvas.md](https://cursor.com/docs/agent/tools/canvas.md) | VIS | body-reviewed | `82960f61a0bc638d` |
| SRC-027 | [agent/tools/search.md](https://cursor.com/docs/agent/tools/search.md) | SEARCH | body-reviewed | `06efa88ffd9ad805` |
| SRC-028 | [agent/tools/terminal.md](https://cursor.com/docs/agent/tools/terminal.md) | AG | indexed | `aa4e8d89606a6c63` |
| SRC-029 | [api.md](https://cursor.com/docs/api.md) | API | indexed | `c63071a0c75a562e` |
| SRC-030 | [approval-agents.md](https://cursor.com/docs/approval-agents.md) | AUTO/REV | indexed | `02047408dfe471a4` |
| SRC-031 | [bugbot.md](https://cursor.com/docs/bugbot.md) | AUTO/REV | indexed | `3e172151b0d017e1` |
| SRC-032 | [cli/acp.md](https://cursor.com/docs/cli/acp.md) | API | indexed | `65f46c6032036469` |
| SRC-033 | [cli/changelog.md](https://cursor.com/docs/cli/changelog.md) | API | indexed | `0b0189af89605b81` |
| SRC-034 | [cli/github-actions.md](https://cursor.com/docs/cli/github-actions.md) | API | indexed | `2bbbc370fb5f187d` |
| SRC-035 | [cli/headless.md](https://cursor.com/docs/cli/headless.md) | API | indexed | `d767966f4e86012b` |
| SRC-036 | [cli/installation.md](https://cursor.com/docs/cli/installation.md) | API | indexed | `50435bbdfe5f3640` |
| SRC-037 | [cli/overview.md](https://cursor.com/docs/cli/overview.md) | API | indexed | `c56ae1d766654ca8` |
| SRC-038 | [cli/reference/authentication.md](https://cursor.com/docs/cli/reference/authentication.md) | API | indexed | `c578539ee1ae3d57` |
| SRC-039 | [cli/reference/configuration.md](https://cursor.com/docs/cli/reference/configuration.md) | API | indexed | `d6921fd7a44cf73c` |
| SRC-040 | [cli/reference/output-format.md](https://cursor.com/docs/cli/reference/output-format.md) | API | indexed | `add17086b1b46485` |
| SRC-041 | [cli/reference/parameters.md](https://cursor.com/docs/cli/reference/parameters.md) | API | indexed | `b50b48d66f4f420a` |
| SRC-042 | [cli/reference/permissions.md](https://cursor.com/docs/cli/reference/permissions.md) | API | indexed | `9f8264f5d8136496` |
| SRC-043 | [cli/reference/slash-commands.md](https://cursor.com/docs/cli/reference/slash-commands.md) | API | indexed | `a39f8c0086b6ca6e` |
| SRC-044 | [cli/reference/terminal-setup.md](https://cursor.com/docs/cli/reference/terminal-setup.md) | API | indexed | `896ae449c38479eb` |
| SRC-045 | [cli/shell-mode.md](https://cursor.com/docs/cli/shell-mode.md) | API | indexed | `7acca7788419524d` |
| SRC-046 | [cli/using.md](https://cursor.com/docs/cli/using.md) | API | indexed | `b070cb1f882dd8e8` |
| SRC-047 | [cloud-agent.md](https://cursor.com/docs/cloud-agent.md) | CLOUD/LOC | indexed | `05c5f6e18b3264fd` |
| SRC-048 | [cloud-agent/api/endpoints.md](https://cursor.com/docs/cloud-agent/api/endpoints.md) | CLOUD/LOC | indexed | `d202e4ef3bfe06cb` |
| SRC-049 | [cloud-agent/api/webhooks.md](https://cursor.com/docs/cloud-agent/api/webhooks.md) | CLOUD/LOC | indexed | `ac1de6fe77d75024` |
| SRC-050 | [cloud-agent/automations.md](https://cursor.com/docs/cloud-agent/automations.md) | AUTO | indexed | `5000fa3b1455aa60` |
| SRC-051 | [cloud-agent/best-practices.md](https://cursor.com/docs/cloud-agent/best-practices.md) | CLOUD/LOC | indexed | `e3a197dbd3769d30` |
| SRC-052 | [cloud-agent/builds.md](https://cursor.com/docs/cloud-agent/builds.md) | CLOUD/LOC | indexed | `4a376bce7f9ef994` |
| SRC-053 | [cloud-agent/capabilities.md](https://cursor.com/docs/cloud-agent/capabilities.md) | CLOUD/LOC | indexed | `5be73548883723da` |
| SRC-054 | [cloud-agent/identity.md](https://cursor.com/docs/cloud-agent/identity.md) | CLOUD/LOC | indexed | `847100758798f57e` |
| SRC-055 | [cloud-agent/metadata.md](https://cursor.com/docs/cloud-agent/metadata.md) | CLOUD/LOC | indexed | `c3aa314c702e8b6e` |
| SRC-056 | [cloud-agent/mobile.md](https://cursor.com/docs/cloud-agent/mobile.md) | LOC/MOB | body-reviewed | `8dceeda181e95501` |
| SRC-057 | [cloud-agent/private-connectivity.md](https://cursor.com/docs/cloud-agent/private-connectivity.md) | CLOUD/LOC | indexed | `0756163d52ed1e3a` |
| SRC-058 | [cloud-agent/security-network.md](https://cursor.com/docs/cloud-agent/security-network.md) | CLOUD/LOC | indexed | `c561e39810a841a4` |
| SRC-059 | [cloud-agent/security.md](https://cursor.com/docs/cloud-agent/security.md) | CLOUD/LOC | indexed | `451db97caabc7f3a` |
| SRC-060 | [cloud-agent/self-hosted.md](https://cursor.com/docs/cloud-agent/self-hosted.md) | CLOUD/LOC | indexed | `a4d668490a485200` |
| SRC-061 | [cloud-agent/self-hosted/choose-runtime.md](https://cursor.com/docs/cloud-agent/self-hosted/choose-runtime.md) | CLOUD/LOC | body-reviewed | `12406754cad851ae` |
| SRC-062 | [cloud-agent/self-hosted/computer-use.md](https://cursor.com/docs/cloud-agent/self-hosted/computer-use.md) | CLOUD/LOC | indexed | `a9ceb020282d7c61` |
| SRC-063 | [cloud-agent/self-hosted/integrations.md](https://cursor.com/docs/cloud-agent/self-hosted/integrations.md) | CLOUD/LOC | indexed | `51d5874ef086ce6a` |
| SRC-064 | [cloud-agent/self-hosted/my-machines.md](https://cursor.com/docs/cloud-agent/self-hosted/my-machines.md) | CLOUD/LOC | body-reviewed | `ece74cf8bf03162f` |
| SRC-065 | [cloud-agent/self-hosted/pool.md](https://cursor.com/docs/cloud-agent/self-hosted/pool.md) | CLOUD/LOC | indexed | `378823ae9e6031db` |
| SRC-066 | [cloud-agent/settings.md](https://cursor.com/docs/cloud-agent/settings.md) | CLOUD/LOC | indexed | `bf1ffd5d60681302` |
| SRC-067 | [cloud-agent/setup.md](https://cursor.com/docs/cloud-agent/setup.md) | CLOUD/LOC | indexed | `af42c287e6b0eb33` |
| SRC-068 | [configuration/worktrees.md](https://cursor.com/docs/configuration/worktrees.md) | WT | body-reviewed | `cc4e372cea406d6f` |
| SRC-069 | [cursor-router.md](https://cursor.com/docs/cursor-router.md) | CTX/MOD/ADM | indexed | `2f5c4032b6fa7568` |
| SRC-070 | [customize-cursor.md](https://cursor.com/docs/customize-cursor.md) | CUS | indexed | `9ae0878d97465512` |
| SRC-071 | [enterprise.md](https://cursor.com/docs/enterprise.md) | SAFE/ADM | indexed | `f03b4bb89714f81b` |
| SRC-072 | [enterprise/admin-setup-guide.md](https://cursor.com/docs/enterprise/admin-setup-guide.md) | SAFE/ADM | indexed | `f457ce2d46a41c7f` |
| SRC-073 | [enterprise/baa.md](https://cursor.com/docs/enterprise/baa.md) | SAFE/ADM | indexed | `9ef7128c12bc964b` |
| SRC-074 | [enterprise/compliance-and-monitoring.md](https://cursor.com/docs/enterprise/compliance-and-monitoring.md) | SAFE/ADM | indexed | `03f32710f906c653` |
| SRC-075 | [enterprise/deployment-patterns.md](https://cursor.com/docs/enterprise/deployment-patterns.md) | SAFE/ADM | indexed | `2dcbc9ea29a94a14` |
| SRC-076 | [enterprise/endpoint-security.md](https://cursor.com/docs/enterprise/endpoint-security.md) | SAFE/ADM | indexed | `1c49f05834f2f059` |
| SRC-077 | [enterprise/identity-and-access-management.md](https://cursor.com/docs/enterprise/identity-and-access-management.md) | SAFE/ADM | indexed | `a14116bc6cb1ce58` |
| SRC-078 | [enterprise/llm-safety-and-controls.md](https://cursor.com/docs/enterprise/llm-safety-and-controls.md) | SAFE/ADM | indexed | `4a4d4bd68097abc8` |
| SRC-079 | [enterprise/model-and-integration-management.md](https://cursor.com/docs/enterprise/model-and-integration-management.md) | SAFE/ADM | indexed | `fb44ba8204f085af` |
| SRC-080 | [enterprise/network-configuration.md](https://cursor.com/docs/enterprise/network-configuration.md) | SAFE/ADM | indexed | `f41885c051f14279` |
| SRC-081 | [enterprise/opentelemetry-export.md](https://cursor.com/docs/enterprise/opentelemetry-export.md) | SAFE/ADM | indexed | `1e751dafcfb89c52` |
| SRC-082 | [enterprise/opentelemetry-export/wire.md](https://cursor.com/docs/enterprise/opentelemetry-export/wire.md) | SAFE/ADM | indexed | `0b82d79bc46dd351` |
| SRC-083 | [enterprise/organization-groups.md](https://cursor.com/docs/enterprise/organization-groups.md) | SAFE/ADM | indexed | `98dcbad0a966cb4f` |
| SRC-084 | [enterprise/organizations.md](https://cursor.com/docs/enterprise/organizations.md) | SAFE/ADM | indexed | `1de58fb2788c8fa1` |
| SRC-085 | [enterprise/pooled-usage.md](https://cursor.com/docs/enterprise/pooled-usage.md) | SAFE/ADM | indexed | `07c668045c3582c7` |
| SRC-086 | [enterprise/privacy-and-data-governance.md](https://cursor.com/docs/enterprise/privacy-and-data-governance.md) | SAFE/ADM | indexed | `e1aefe24c2b7954a` |
| SRC-087 | [enterprise/security-hardening.md](https://cursor.com/docs/enterprise/security-hardening.md) | SAFE/ADM | indexed | `51c963092bc617f5` |
| SRC-088 | [get-started/quickstart.md](https://cursor.com/docs/get-started/quickstart.md) | IDE | indexed | `f1644b24b45f5ed6` |
| SRC-089 | [grok-bot.md](https://cursor.com/docs/grok-bot.md) | BOT | indexed | `57375bdcd9cdaa20` |
| SRC-090 | [grok-bot/get-started.md](https://cursor.com/docs/grok-bot/get-started.md) | BOT | indexed | `033a5c86d506a7e9` |
| SRC-091 | [grok-bot/identity.md](https://cursor.com/docs/grok-bot/identity.md) | BOT | indexed | `d4f1742046bdd08b` |
| SRC-092 | [grok-bot/private-networks.md](https://cursor.com/docs/grok-bot/private-networks.md) | BOT | indexed | `4cedc48123ede682` |
| SRC-093 | [grok-bot/proxies.md](https://cursor.com/docs/grok-bot/proxies.md) | BOT | indexed | `ac3a32e38f91fcdb` |
| SRC-094 | [grok-bot/security-faq.md](https://cursor.com/docs/grok-bot/security-faq.md) | BOT | indexed | `d6e3168572ababcb` |
| SRC-095 | [grok-bot/security.md](https://cursor.com/docs/grok-bot/security.md) | BOT | indexed | `43e1c02d8a834aca` |
| SRC-096 | [grok-bot/settings.md](https://cursor.com/docs/grok-bot/settings.md) | BOT | indexed | `e75fda95593000e3` |
| SRC-097 | [grok-bot/teams.md](https://cursor.com/docs/grok-bot/teams.md) | BOT | indexed | `88169e3ab3c3918f` |
| SRC-098 | [grok-bot/use-cases.md](https://cursor.com/docs/grok-bot/use-cases.md) | BOT | indexed | `7941b5fab61161f1` |
| SRC-099 | [grok-bot/work.md](https://cursor.com/docs/grok-bot/work.md) | BOT | indexed | `37e3cc4e7906a872` |
| SRC-100 | [hooks.md](https://cursor.com/docs/hooks.md) | CUS | indexed | `a436c550bdd80c29` |
| SRC-101 | [integrations/azure-devops.md](https://cursor.com/docs/integrations/azure-devops.md) | INT/SCM | indexed | `f9acee73f2682324` |
| SRC-102 | [integrations/bitbucket.md](https://cursor.com/docs/integrations/bitbucket.md) | INT/SCM | indexed | `ba92765d52e4263f` |
| SRC-103 | [integrations/cursor-blame.md](https://cursor.com/docs/integrations/cursor-blame.md) | ADM | indexed | `8f5eed40d997dbda` |
| SRC-104 | [integrations/github.md](https://cursor.com/docs/integrations/github.md) | INT/SCM | indexed | `a85477de53c40647` |
| SRC-105 | [integrations/gitlab.md](https://cursor.com/docs/integrations/gitlab.md) | INT/SCM | indexed | `4f850145a7e6e0bf` |
| SRC-106 | [integrations/jetbrains.md](https://cursor.com/docs/integrations/jetbrains.md) | INT/SCM | indexed | `088e79280216081e` |
| SRC-107 | [integrations/jira.md](https://cursor.com/docs/integrations/jira.md) | INT/SCM | indexed | `ebae347e791364d2` |
| SRC-108 | [integrations/linear.md](https://cursor.com/docs/integrations/linear.md) | INT/SCM | indexed | `7dbb3617f056d268` |
| SRC-109 | [integrations/microsoft-teams.md](https://cursor.com/docs/integrations/microsoft-teams.md) | INT/SCM | indexed | `16629cc44d628593` |
| SRC-110 | [integrations/notion.md](https://cursor.com/docs/integrations/notion.md) | INT/SCM | indexed | `04018a44c8ce31d1` |
| SRC-111 | [integrations/slack.md](https://cursor.com/docs/integrations/slack.md) | INT/SCM | indexed | `e8848bf35d592b99` |
| SRC-112 | [integrations/xcode.md](https://cursor.com/docs/integrations/xcode.md) | INT/SCM | indexed | `04775562c95a29b5` |
| SRC-113 | [mcp.md](https://cursor.com/docs/mcp.md) | CUS | indexed | `c8fe6bb4d56d582f` |
| SRC-114 | [models-and-pricing.md](https://cursor.com/docs/models-and-pricing.md) | CTX/MOD/ADM | indexed | `421e544605f736d8` |
| SRC-115 | [models/claude-fable-5-1.md](https://cursor.com/docs/models/claude-fable-5-1.md) | CTX/MOD/ADM | indexed | `627b0bd89368c550` |
| SRC-116 | [models/claude-opus-5.md](https://cursor.com/docs/models/claude-opus-5.md) | CTX/MOD/ADM | indexed | `bf46bc9979bbd6f4` |
| SRC-117 | [models/claude-sonnet-5.md](https://cursor.com/docs/models/claude-sonnet-5.md) | CTX/MOD/ADM | indexed | `dd340e5586e3e0ae` |
| SRC-118 | [models/cursor-composer-2-5.md](https://cursor.com/docs/models/cursor-composer-2-5.md) | CTX/MOD/ADM | indexed | `00f8a964172adfaf` |
| SRC-119 | [models/gemini-3-1-pro.md](https://cursor.com/docs/models/gemini-3-1-pro.md) | CTX/MOD/ADM | indexed | `12aed3205ed7d636` |
| SRC-120 | [models/gemini-3-8-flash.md](https://cursor.com/docs/models/gemini-3-8-flash.md) | CTX/MOD/ADM | indexed | `503e8ef59e60aa76` |
| SRC-121 | [models/gpt-5-6-luna.md](https://cursor.com/docs/models/gpt-5-6-luna.md) | CTX/MOD/ADM | indexed | `0c389d9e33adf475` |
| SRC-122 | [models/gpt-5-6-sol.md](https://cursor.com/docs/models/gpt-5-6-sol.md) | CTX/MOD/ADM | indexed | `e0bcd729c03c1402` |
| SRC-123 | [models/gpt-5-6-terra.md](https://cursor.com/docs/models/gpt-5-6-terra.md) | CTX/MOD/ADM | indexed | `876e44c4040cabb5` |
| SRC-124 | [models/grok-4-5.md](https://cursor.com/docs/models/grok-4-5.md) | CTX/MOD/ADM | indexed | `4a515354b19c520b` |
| SRC-125 | [models/grok-4-6.md](https://cursor.com/docs/models/grok-4-6.md) | CTX/MOD/ADM | indexed | `1a7aac20114b3006` |
| SRC-126 | [models/muse-spark-1-3.md](https://cursor.com/docs/models/muse-spark-1-3.md) | CTX/MOD/ADM | indexed | `5b523076f9f8c991` |
| SRC-127 | [origin.md](https://cursor.com/docs/origin.md) | SCM/API | indexed | `657bb332de0d620b` |
| SRC-128 | [origin/browse.md](https://cursor.com/docs/origin/browse.md) | SCM/API | indexed | `eb05c29b40113ac7` |
| SRC-129 | [origin/cli.md](https://cursor.com/docs/origin/cli.md) | SCM/API | indexed | `99b1ca453cf4f557` |
| SRC-130 | [origin/cli/reference/commands.md](https://cursor.com/docs/origin/cli/reference/commands.md) | SCM/API | indexed | `e754ce0091e4e356` |
| SRC-131 | [origin/cli/reference/pull-requests.md](https://cursor.com/docs/origin/cli/reference/pull-requests.md) | SCM/API | indexed | `3aa9b41853904e80` |
| SRC-132 | [origin/codebase-settings.md](https://cursor.com/docs/origin/codebase-settings.md) | SCM/API | indexed | `e1a1af8c366ff2fc` |
| SRC-133 | [origin/create-repository.md](https://cursor.com/docs/origin/create-repository.md) | SCM/API | indexed | `62017ee9fde148b5` |
| SRC-134 | [origin/git.md](https://cursor.com/docs/origin/git.md) | SCM/API | indexed | `9a0ead4bf076fd2a` |
| SRC-135 | [origin/integrations.md](https://cursor.com/docs/origin/integrations.md) | SCM/API | indexed | `11e905ce634e250b` |
| SRC-136 | [origin/mirror-github.md](https://cursor.com/docs/origin/mirror-github.md) | SCM/API | indexed | `d7a9bc4b381e458a` |
| SRC-137 | [origin/pull-requests.md](https://cursor.com/docs/origin/pull-requests.md) | SCM/API | indexed | `32a959841f866852` |
| SRC-138 | [origin/settings.md](https://cursor.com/docs/origin/settings.md) | SCM/API | indexed | `d246d7c31a4206ab` |
| SRC-139 | [plugins.md](https://cursor.com/docs/plugins.md) | CUS | indexed | `1c3271020f523438` |
| SRC-140 | [reference/deeplinks.md](https://cursor.com/docs/reference/deeplinks.md) | INT | indexed | `7e91b22eaa0883aa` |
| SRC-141 | [rules.md](https://cursor.com/docs/rules.md) | CUS | indexed | `3206c9381dce1fd1` |
| SRC-142 | [sdk/bridge.md](https://cursor.com/docs/sdk/bridge.md) | API | indexed | `e1670e507eb0a75c` |
| SRC-143 | [sdk/changelog.md](https://cursor.com/docs/sdk/changelog.md) | API | indexed | `cb3f5130be508381` |
| SRC-144 | [sdk/python.md](https://cursor.com/docs/sdk/python.md) | API | indexed | `62bb82a6870c57f9` |
| SRC-145 | [sdk/typescript.md](https://cursor.com/docs/sdk/typescript.md) | API | indexed | `a57d4f8515cdc7b1` |
| SRC-146 | [security-agents.md](https://cursor.com/docs/security-agents.md) | AUTO/REV | indexed | `8096b030c076c08e` |
| SRC-147 | [skills.md](https://cursor.com/docs/skills.md) | CUS | indexed | `e6a3d52df745be78` |
| SRC-148 | [subagents.md](https://cursor.com/docs/subagents.md) | CUS | indexed | `187b052042c53a4c` |

## แหล่งเสริมที่อ่าน/ดูในรอบวางแผน

| Source | หลักฐานที่ใช้ | Coverage |
|---|---|---|
| [Cursor home](https://cursor.com/home) | browser screenshot/demo inspected | V01/AG |
| [Cursor App Store](https://apps.apple.com/us/app/cursor/id6767085653) | screenshot set inspected; listing 1.8.0 / Sep 1 | V03/MOB |
| [Tab help](https://cursor.com/help/ai-features/tab) | body reviewed | TAB |
| [Inline edit help](https://cursor.com/help/ai-features/inline-edit) | retrieved | EDIT |
| [Ignore files](https://cursor.com/docs/reference/ignore-file) | body reviewed | SEARCH |
| [Plugin reference](https://cursor.com/docs/reference/plugins) | retrieved; full schema validation pending | CUS |
| [Changelog](https://cursor.com/changelog) | current entries reviewed | CLOUD/AUTO/SCM |
| [VS Code FAQ](https://code.visualstudio.com/docs/supporting/faq#extensions) | distribution/extension constraints | IDE/G-EXT |
| [Codex App Server](https://learn.chatgpt.com/docs/app-server) | auth/events/custom client docs | engines |
| [Codex auth](https://learn.chatgpt.com/docs/auth) | subscription vs API | engines |
| [OpenCode server](https://opencode.ai/docs/server/) | API boundary | engines |
| [OpenCode Go](https://opencode.ai/docs/go/) | external coding clients/session headers | providers |
| [OpenRouter](https://openrouter.ai/docs/quickstart) | official API | providers |
| [Paseo SDK](https://paseo.sh/docs/sdk/quickstart) | lifecycle/status semantics | runtime |
| [Paseo connectivity](https://paseo.sh/docs/connectivity) | relay/private/SSH topology | LOC |

## Source revisions: investigation snapshots

รายการนี้เป็น revision ที่ตรวจ ไม่ใช่ production dependency lock: latest release และ default branch อาจมี capabilities ต่างกัน

| Repository | Snapshot commit | Latest non-prerelease reported | Observation |
|---|---|---|---|
| [microsoft/vscode](https://github.com/microsoft/vscode) | [eb10336690ba](https://github.com/microsoft/vscode/commit/eb10336690ba9c8043eb13064896f9acf318802c) | 1.136.2 | branch main; metadata license MIT; archived=False |
| [getpaseo/paseo](https://github.com/getpaseo/paseo) | [433e67b18b79](https://github.com/getpaseo/paseo/commit/433e67b18b7964a92d593bdc78c518143accfc8b) | v0.7.2 | branch main; metadata license NOASSERTION; archived=False; actual LICENSE Apache-2.0 + third-party notices |
| [openai/codex](https://github.com/openai/codex) | [73a1148c9c77](https://github.com/openai/codex/commit/73a1148c9c775c2a4616ce5096291740a00ed68a) | rust-v0.153.4 | branch main; metadata license Apache-2.0; archived=False |
| [anomalyco/opencode](https://github.com/anomalyco/opencode) | [830d5eb53548](https://github.com/anomalyco/opencode/commit/830d5eb5354874105cc31599635a80c1662609e8) | v1.18.30 | branch dev; metadata license MIT; archived=False |
| [VSCodium/vscodium](https://github.com/VSCodium/vscodium) | [5a73682ca091](https://github.com/VSCodium/vscodium/commit/5a73682ca091082675b10c9dc3f348c1d824d94f) | 1.135.06055 | branch master; metadata license MIT; archived=False |
| [continuedev/continue](https://github.com/continuedev/continue) | [5522c6f44ca0](https://github.com/continuedev/continue/commit/5522c6f44ca0ac3528b37244818fbfa39b5af470) | v2.0.0-vscode | branch main; metadata license Apache-2.0; archived=False; README states no active maintenance |
| [voideditor/void](https://github.com/voideditor/void) | [b3166e7ef2ae](https://github.com/voideditor/void/commit/b3166e7ef2aefbdfeb139445fdf248a561b85d4d) | unavailable | branch main; metadata license Apache-2.0; archived=True |
| [TabbyML/tabby](https://github.com/TabbyML/tabby) | [21b29048d7bc](https://github.com/TabbyML/tabby/commit/21b29048d7bcf6b94f9f482f2d0fd05efadfd19f) | v0.32.0 | branch main; metadata license NOASSERTION; archived=False |
| [go-gitea/gitea](https://github.com/go-gitea/gitea) | [92f2f6161b4c](https://github.com/go-gitea/gitea/commit/92f2f6161b4c4e5c91c38a3615ce8e5711f9457b) | v1.27.3 | branch main; metadata license MIT; archived=False |

## วิธีใช้หลักฐาน

- source title, README claim, API metadata และ verified behavior แยกกันเสมอ ไม่ใช้โครงการมี stars/push ล่าสุดรับรอง maintenance หรือ compatibility
- canonical source facts ใช้สำหรับตัดสินใจ; scores/stack choices/acceptance targets เป็น judgement ของแผน Caret
- ทุก indexed family มี requirement ใน PARITY-MATRIX; account-specific/hidden features และ pixel measurements อยู่ gap register
- วันที่ baseline ไม่ auto-advance: เมื่อเอกสารหรือ app version เปลี่ยนให้บันทึก delta ก่อนขยาย scope
