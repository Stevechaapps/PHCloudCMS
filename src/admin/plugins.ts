// src/admin/plugins.ts — plugin manager admin page body.

import { esc } from "../cms/escape.js";

var PLUGIN_CATEGORIES = [
  { key: "seo", label: "SEO" },
  { key: "security", label: "Security" },
  { key: "forms", label: "Forms" },
  { key: "analytics", label: "Analytics" },
  { key: "backup", label: "Backup & Export" },
  { key: "ecommerce", label: "E-Commerce" },
  { key: "social", label: "Social" },
  { key: "media", label: "Media" },
  { key: "custom", label: "Custom" },
];

export function pluginsBody(
  availablePlugins: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    version: string;
    author: string;
    hooks: string[];
  }>,
  activePluginIds: Set<string>,
): string {
  var byCategory: Record<string, typeof availablePlugins> = {};
  for (var i = 0; i < availablePlugins.length; i++) {
    var p = availablePlugins[i];
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  }

  var html = '<h2 style="margin-bottom:0.5rem">Plugins</h2>';
  html +=
    '<p style="color:var(--ad-muted);margin-bottom:2rem;font-size:0.9rem">Toggle plugins on or off. Changes take effect immediately.</p>';

  for (var c = 0; c < PLUGIN_CATEGORIES.length; c++) {
    var cat = PLUGIN_CATEGORIES[c];
    var plugins = byCategory[cat.key];
    if (!plugins || !plugins.length) continue;

    html +=
      '<h3 style="margin:2rem 0 1rem;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--ad-muted)">';
    html += esc(cat.label) + "</h3>";
    html +=
      '<div style="background:var(--ad-card);border:1px solid var(--ad-card-bd);border-radius:6px;overflow:hidden;margin-bottom:1.5rem">';

    for (var j = 0; j < plugins.length; j++) {
      var pl = plugins[j];
      var isActive = activePluginIds.has(pl.id);
      html +=
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;';
      html += 'border-bottom:1px solid var(--ad-row-bd)">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-weight:600;font-size:0.95rem">' + esc(pl.name);
      html +=
        ' <span style="font-weight:400;color:var(--ad-muted);font-size:0.8rem">v' +
        esc(pl.version) +
        "</span></div>";
      html +=
        '<div style="color:var(--ad-muted);font-size:0.85rem;margin-top:0.2rem">' +
        esc(pl.description) +
        "</div>";
      html +=
        '<div style="color:var(--ad-muted);font-size:0.75rem;margin-top:0.3rem">by ' +
        esc(pl.author);
      html += " · hooks: " + esc(pl.hooks.join(", ")) + "</div>";
      html += "</div>";
      html += '<div style="margin-left:1.5rem;flex-shrink:0">';
      html +=
        '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">';
      html +=
        '<input type="checkbox" class="plugin-toggle" data-plugin="' +
        esc(pl.id) +
        '"';
      html += isActive ? " checked" : "";
      html += " />";
      html +=
        '<span style="font-size:0.85rem;color:var(--ad-muted)">' +
        (isActive ? "Active" : "Inactive") +
        "</span>";
      html += "</label></div></div>";
    }

    html += "</div>";
  }

  if (!availablePlugins.length) {
    html +=
      '<div style="text-align:center;padding:3rem;color:var(--ad-muted)">No plugins available.';
    html +=
      " Add files to <code>src/plugins/</code> and list them in <code>src/plugins/index.ts</code>.</div>";
  }

  html += "<script>";
  html +=
    'document.querySelectorAll(".plugin-toggle").forEach(function(cb){cb.addEventListener("change",function(){';
  html += "var id=cb.dataset.plugin;cb.disabled=true;";
  html +=
    'fetch("/api/admin/plugins/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},';
  html +=
    "body:JSON.stringify({active:cb.checked})}).then(function(res){cb.disabled=false;";
  html += 'if(!res.ok){cb.checked=!cb.checked;alert("Failed to save")}';
  html += 'var span=cb.closest("label").querySelector("span");';
  html += 'if(span)span.textContent=cb.checked?"Active":"Inactive"})})});';
  html += "</script>";

  return html;
}
