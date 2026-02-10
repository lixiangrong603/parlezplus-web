import { onRequestDelete as __api_users__id__api_keys_ts_onRequestDelete } from "D:\\magic box\\parlezplus-web\\functions\\api\\users\\[id]\\api-keys.ts"
import { onRequestGet as __api_users__id__api_keys_ts_onRequestGet } from "D:\\magic box\\parlezplus-web\\functions\\api\\users\\[id]\\api-keys.ts"
import { onRequestPut as __api_users__id__api_keys_ts_onRequestPut } from "D:\\magic box\\parlezplus-web\\functions\\api\\users\\[id]\\api-keys.ts"
import { onRequestPost as __api_users__id__change_password_ts_onRequestPost } from "D:\\magic box\\parlezplus-web\\functions\\api\\users\\[id]\\change-password.ts"
import { onRequestDelete as __api_classrooms___id___ts_onRequestDelete } from "D:\\magic box\\parlezplus-web\\functions\\api\\classrooms\\[[id]].ts"
import { onRequestGet as __api_classrooms___id___ts_onRequestGet } from "D:\\magic box\\parlezplus-web\\functions\\api\\classrooms\\[[id]].ts"
import { onRequestPost as __api_classrooms___id___ts_onRequestPost } from "D:\\magic box\\parlezplus-web\\functions\\api\\classrooms\\[[id]].ts"
import { onRequestPut as __api_classrooms___id___ts_onRequestPut } from "D:\\magic box\\parlezplus-web\\functions\\api\\classrooms\\[[id]].ts"
import { onRequestGet as __api_exams___id___ts_onRequestGet } from "D:\\magic box\\parlezplus-web\\functions\\api\\exams\\[[id]].ts"
import { onRequestPost as __api_exams___id___ts_onRequestPost } from "D:\\magic box\\parlezplus-web\\functions\\api\\exams\\[[id]].ts"
import { onRequestDelete as __api_practice___id___ts_onRequestDelete } from "D:\\magic box\\parlezplus-web\\functions\\api\\practice\\[[id]].ts"
import { onRequestGet as __api_practice___id___ts_onRequestGet } from "D:\\magic box\\parlezplus-web\\functions\\api\\practice\\[[id]].ts"
import { onRequestPost as __api_practice___id___ts_onRequestPost } from "D:\\magic box\\parlezplus-web\\functions\\api\\practice\\[[id]].ts"
import { onRequestDelete as __api_questions___id___ts_onRequestDelete } from "D:\\magic box\\parlezplus-web\\functions\\api\\questions\\[[id]].ts"
import { onRequestGet as __api_questions___id___ts_onRequestGet } from "D:\\magic box\\parlezplus-web\\functions\\api\\questions\\[[id]].ts"
import { onRequestPost as __api_questions___id___ts_onRequestPost } from "D:\\magic box\\parlezplus-web\\functions\\api\\questions\\[[id]].ts"
import { onRequestPut as __api_questions___id___ts_onRequestPut } from "D:\\magic box\\parlezplus-web\\functions\\api\\questions\\[[id]].ts"
import { onRequestDelete as __api_resources___id___ts_onRequestDelete } from "D:\\magic box\\parlezplus-web\\functions\\api\\resources\\[[id]].ts"
import { onRequestGet as __api_resources___id___ts_onRequestGet } from "D:\\magic box\\parlezplus-web\\functions\\api\\resources\\[[id]].ts"
import { onRequestPost as __api_resources___id___ts_onRequestPost } from "D:\\magic box\\parlezplus-web\\functions\\api\\resources\\[[id]].ts"
import { onRequestPut as __api_resources___id___ts_onRequestPut } from "D:\\magic box\\parlezplus-web\\functions\\api\\resources\\[[id]].ts"
import { onRequestDelete as __api_users___id___ts_onRequestDelete } from "D:\\magic box\\parlezplus-web\\functions\\api\\users\\[[id]].ts"
import { onRequestGet as __api_users___id___ts_onRequestGet } from "D:\\magic box\\parlezplus-web\\functions\\api\\users\\[[id]].ts"
import { onRequestPost as __api_users___id___ts_onRequestPost } from "D:\\magic box\\parlezplus-web\\functions\\api\\users\\[[id]].ts"
import { onRequestPut as __api_users___id___ts_onRequestPut } from "D:\\magic box\\parlezplus-web\\functions\\api\\users\\[[id]].ts"
import { onRequest as __api_media___path___ts_onRequest } from "D:\\magic box\\parlezplus-web\\functions\\api\\media\\[[path]].ts"
import { onRequestGet as __api_auth_ts_onRequestGet } from "D:\\magic box\\parlezplus-web\\functions\\api\\auth.ts"
import { onRequestPost as __api_auth_ts_onRequestPost } from "D:\\magic box\\parlezplus-web\\functions\\api\\auth.ts"
import { onRequestGet as __api_diag_ts_onRequestGet } from "D:\\magic box\\parlezplus-web\\functions\\api\\diag.ts"
import { onRequestPost as __api_proxy_gemini_ts_onRequestPost } from "D:\\magic box\\parlezplus-web\\functions\\api\\proxy-gemini.ts"
import { onRequestPost as __api_upload_ts_onRequestPost } from "D:\\magic box\\parlezplus-web\\functions\\api\\upload.ts"
import { onRequest as __api_import_ts_onRequest } from "D:\\magic box\\parlezplus-web\\functions\\api\\import.ts"
import { onRequest as ___middleware_ts_onRequest } from "D:\\magic box\\parlezplus-web\\functions\\_middleware.ts"

export const routes = [
    {
      routePath: "/api/users/:id/api-keys",
      mountPath: "/api/users/:id",
      method: "DELETE",
      middlewares: [],
      modules: [__api_users__id__api_keys_ts_onRequestDelete],
    },
  {
      routePath: "/api/users/:id/api-keys",
      mountPath: "/api/users/:id",
      method: "GET",
      middlewares: [],
      modules: [__api_users__id__api_keys_ts_onRequestGet],
    },
  {
      routePath: "/api/users/:id/api-keys",
      mountPath: "/api/users/:id",
      method: "PUT",
      middlewares: [],
      modules: [__api_users__id__api_keys_ts_onRequestPut],
    },
  {
      routePath: "/api/users/:id/change-password",
      mountPath: "/api/users/:id",
      method: "POST",
      middlewares: [],
      modules: [__api_users__id__change_password_ts_onRequestPost],
    },
  {
      routePath: "/api/classrooms/:id*",
      mountPath: "/api/classrooms",
      method: "DELETE",
      middlewares: [],
      modules: [__api_classrooms___id___ts_onRequestDelete],
    },
  {
      routePath: "/api/classrooms/:id*",
      mountPath: "/api/classrooms",
      method: "GET",
      middlewares: [],
      modules: [__api_classrooms___id___ts_onRequestGet],
    },
  {
      routePath: "/api/classrooms/:id*",
      mountPath: "/api/classrooms",
      method: "POST",
      middlewares: [],
      modules: [__api_classrooms___id___ts_onRequestPost],
    },
  {
      routePath: "/api/classrooms/:id*",
      mountPath: "/api/classrooms",
      method: "PUT",
      middlewares: [],
      modules: [__api_classrooms___id___ts_onRequestPut],
    },
  {
      routePath: "/api/exams/:id*",
      mountPath: "/api/exams",
      method: "GET",
      middlewares: [],
      modules: [__api_exams___id___ts_onRequestGet],
    },
  {
      routePath: "/api/exams/:id*",
      mountPath: "/api/exams",
      method: "POST",
      middlewares: [],
      modules: [__api_exams___id___ts_onRequestPost],
    },
  {
      routePath: "/api/practice/:id*",
      mountPath: "/api/practice",
      method: "DELETE",
      middlewares: [],
      modules: [__api_practice___id___ts_onRequestDelete],
    },
  {
      routePath: "/api/practice/:id*",
      mountPath: "/api/practice",
      method: "GET",
      middlewares: [],
      modules: [__api_practice___id___ts_onRequestGet],
    },
  {
      routePath: "/api/practice/:id*",
      mountPath: "/api/practice",
      method: "POST",
      middlewares: [],
      modules: [__api_practice___id___ts_onRequestPost],
    },
  {
      routePath: "/api/questions/:id*",
      mountPath: "/api/questions",
      method: "DELETE",
      middlewares: [],
      modules: [__api_questions___id___ts_onRequestDelete],
    },
  {
      routePath: "/api/questions/:id*",
      mountPath: "/api/questions",
      method: "GET",
      middlewares: [],
      modules: [__api_questions___id___ts_onRequestGet],
    },
  {
      routePath: "/api/questions/:id*",
      mountPath: "/api/questions",
      method: "POST",
      middlewares: [],
      modules: [__api_questions___id___ts_onRequestPost],
    },
  {
      routePath: "/api/questions/:id*",
      mountPath: "/api/questions",
      method: "PUT",
      middlewares: [],
      modules: [__api_questions___id___ts_onRequestPut],
    },
  {
      routePath: "/api/resources/:id*",
      mountPath: "/api/resources",
      method: "DELETE",
      middlewares: [],
      modules: [__api_resources___id___ts_onRequestDelete],
    },
  {
      routePath: "/api/resources/:id*",
      mountPath: "/api/resources",
      method: "GET",
      middlewares: [],
      modules: [__api_resources___id___ts_onRequestGet],
    },
  {
      routePath: "/api/resources/:id*",
      mountPath: "/api/resources",
      method: "POST",
      middlewares: [],
      modules: [__api_resources___id___ts_onRequestPost],
    },
  {
      routePath: "/api/resources/:id*",
      mountPath: "/api/resources",
      method: "PUT",
      middlewares: [],
      modules: [__api_resources___id___ts_onRequestPut],
    },
  {
      routePath: "/api/users/:id*",
      mountPath: "/api/users",
      method: "DELETE",
      middlewares: [],
      modules: [__api_users___id___ts_onRequestDelete],
    },
  {
      routePath: "/api/users/:id*",
      mountPath: "/api/users",
      method: "GET",
      middlewares: [],
      modules: [__api_users___id___ts_onRequestGet],
    },
  {
      routePath: "/api/users/:id*",
      mountPath: "/api/users",
      method: "POST",
      middlewares: [],
      modules: [__api_users___id___ts_onRequestPost],
    },
  {
      routePath: "/api/users/:id*",
      mountPath: "/api/users",
      method: "PUT",
      middlewares: [],
      modules: [__api_users___id___ts_onRequestPut],
    },
  {
      routePath: "/api/media/:path*",
      mountPath: "/api/media",
      method: "",
      middlewares: [],
      modules: [__api_media___path___ts_onRequest],
    },
  {
      routePath: "/api/auth",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_ts_onRequestGet],
    },
  {
      routePath: "/api/auth",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_ts_onRequestPost],
    },
  {
      routePath: "/api/diag",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_diag_ts_onRequestGet],
    },
  {
      routePath: "/api/proxy-gemini",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_proxy_gemini_ts_onRequestPost],
    },
  {
      routePath: "/api/upload",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_upload_ts_onRequestPost],
    },
  {
      routePath: "/api/import",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_import_ts_onRequest],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_ts_onRequest],
      modules: [],
    },
  ]