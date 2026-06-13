import type { ReactNode } from "react";

export const metadata = {
  title: "Archmantic",
  description: "Living architecture model — shared team knowledge.",
};

const css = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0f1115; color: #e6e9ef;
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  a { color: #7aa2f7; text-decoration: none; } a:hover { text-decoration: underline; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 32px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 32px 0 12px;
    padding-bottom: 8px; border-bottom: 1px solid #232734; }
  .sub { color: #8b93a7; font-size: 13px; }
  .card { background: #171a21; border: 1px solid #232734; border-radius: 12px; padding: 16px 18px; }
  .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .trust { display: flex; gap: 24px; flex-wrap: wrap; align-items: center; margin: 16px 0; }
  .stat .num { font-size: 20px; font-weight: 600; margin-right: 6px; } .stat { font-size: 13px; color: #8b93a7; }
  .bands { margin-left: auto; display: flex; gap: 8px; }
  .b { font-size: 12px; padding: 3px 9px; border-radius: 999px; }
  .b.high { background: #14331f; color: #4ade80; } .b.medium { background: #33300f; color: #facc15; } .b.low { background: #331616; color: #f87171; }
  ul.caps { list-style: none; margin: 0; padding: 0; }
  ul.caps li { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid #1f232e; align-items: baseline; }
  .area h3 { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: #8b93a7; margin: 0 0 8px; }
  .badge { font-size: 11px; white-space: nowrap; }
  .badge.high { color: #4ade80; } .badge.medium { color: #facc15; } .badge.low { color: #f87171; }
  .empty { color: #8b93a7; font-style: italic; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #8b93a7; }
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
