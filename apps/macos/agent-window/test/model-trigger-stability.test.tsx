import { expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ComposerModelMenuTrigger } from "../vendor/synara/apps/web/src/components/chat/ComposerModelMenuTrigger";
import { Menu } from "../vendor/synara/apps/web/src/components/ui/menu";

it("shows the selected model while keeping width fixed across names and efforts", () => {
  const render = (modelLabel: string, statusLabel: string, compact: boolean) => renderToStaticMarkup(
    <Menu>
      <ComposerModelMenuTrigger provider="omp" modelLabel={modelLabel} statusLabel={statusLabel}
        showsFastBadge={compact} hideModelLabel={compact} hideStatusLabel={compact} isMenuOpen={false} />
    </Menu>,
  );
  const short = render("Small", "low", false);
  const long = render("A model with a very long provider and version name", "extra high", true);
  for (const markup of [short, long]) {
    expect(markup).toContain("truncate");
    expect(markup).toContain("w-56 min-w-0 max-w-full shrink");
  }
  expect(render("", "", false)).toContain("Select model/effort");
  expect(short).toContain(">Small</span>");
  expect(short).toContain(">low</span>");
  expect(long).toContain(">extra high</span>");
  expect(short).toContain('title="Small · low"');
  expect(long).toContain('title="A model with a very long provider and version name · extra high · Fast"');
});
