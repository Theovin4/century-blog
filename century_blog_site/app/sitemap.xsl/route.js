import { NextResponse } from "next/server";

const stylesheet = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes" />
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Century Blog Sitemap</title>
        <style>
          body { font-family: Segoe UI, Arial, sans-serif; background:#09090d; color:#f5f7fb; margin:0; padding:2rem; }
          .wrap { max-width:1100px; margin:0 auto; }
          h1 { margin-bottom:0.35rem; }
          p { color:#a3abc2; line-height:1.6; }
          table { width:100%; border-collapse:collapse; margin-top:1.5rem; background:#12131a; border-radius:18px; overflow:hidden; }
          th, td { padding:0.9rem 1rem; text-align:left; border-bottom:1px solid rgba(255,255,255,0.08); }
          th { color:#5ef2ff; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.08em; }
          a { color:#ffcf5a; text-decoration:none; }
          a:hover { text-decoration:underline; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Century Blog Sitemap</h1>
          <p>This sitemap lists the public URLs available for search engines and readers.</p>
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Last Modified</th>
                <th>Change Frequency</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="s:urlset/s:url">
                <tr>
                  <td><a><xsl:attribute name="href"><xsl:value-of select="s:loc" /></xsl:attribute><xsl:value-of select="s:loc" /></a></td>
                  <td><xsl:value-of select="s:lastmod" /></td>
                  <td><xsl:value-of select="s:changefreq" /></td>
                  <td><xsl:value-of select="s:priority" /></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>`;

export function GET() {
  return new NextResponse(stylesheet, {
    headers: {
      "Content-Type": "text/xsl; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
