import c from "axios";
import { useNotifications as p } from "pvtables/notify";
const l = (o) => {
  const t = c.create({
    baseURL: `https://xn-----6kcbab0cjcacpbcc1c1bdgfjoon.xn--p1ai/api/${o}`,
    timeout: 1e4
  }), { notify: r } = p();
  return t.interceptors.request.use(
    (e) => e,
    (e) => {
      r("error", { detail: e.message }), Promise.reject(e);
    }
  ), t.interceptors.response.use(
    ({ data: e }) => {
      if (!e.success)
        throw new Error(response.message);
      return e;
    },
    ({ message: e, response: s }) => {
      r("error", { detail: e });
    }
  ), {
    create: async (e = null, s = {}) => await t.put("/", e, { params: s }),
    read: async (e = {}) => await t.get("/", { params: e }),
    update: async (e = null, s = {}) => await t.patch("/", e, { params: s }),
    delete: async (e = {}) => await t.delete("/", { params: e }),
    options: async (e = null, s = {}) => {
      const n = {
        api_action: "options",
        ...s
      };
      return await t.post("/", e, { params: n });
    },
    autocomplete: async (e = null, s = {}) => {
      const n = {
        api_action: "autocomplete",
        ...s
      };
      return await t.post("/", e, { params: n });
    }
  };
};
export {
  l as default
};
