// src/admin.ts — barrel re-export of the split admin template modules.
// Routes keep importing these names from "../admin.js" unchanged; the per-
// concern bodies now live under src/admin/. (Phase 3 split.)

export { adminShell } from "./admin/shell.js";
export { dashboardBody } from "./admin/dashboard.js";
export { postsBody, newPostBody, editBody } from "./admin/posts.js";
export { pagesBody, newPageBody, editPageBody } from "./admin/pages.js";
export { tagsBody } from "./admin/tags.js";
export { navBody } from "./admin/nav.js";
export { settingsBody } from "./admin/settings.js";
export { imagesBody } from "./admin/images.js";
export { pluginsBody } from "./admin/plugins.js";
export { loginForm } from "./admin/login.js";
