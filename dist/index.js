import { defineComponent as Re, ref as n, onMounted as Me, resolveComponent as Ne, openBlock as c, createElementBlock as g, createVNode as d, unref as o, withCtx as u, Fragment as M, renderList as A, createBlock as k, normalizeClass as oe, createElementVNode as D, toDisplayString as F, createTextVNode as K, createSlots as Le, createCommentVNode as Q } from "vue";
import Ae from "primevue/datatable";
import E from "primevue/column";
import V from "primevue/button";
import Ee from "primevue/toolbar";
import W from "primevue/dialog";
import U from "axios";
import J from "primevue/inputtext";
import se from "primevue/textarea";
import z from "primevue/inputnumber";
import X from "primevue/inputswitch";
import { FilterOperator as re, FilterMatchMode as ne } from "primevue/api";
const ze = { class: "card" }, Be = { class: "p-3" }, $e = { class: "p-field" }, je = ["for"], qe = ["id"], Ge = { class: "confirmation-content" }, He = /* @__PURE__ */ D("i", {
  class: "pi pi-exclamation-triangle p-mr-3",
  style: { "font-size": "2rem" }
}, null, -1), Ke = { key: 0 }, Qe = { class: "confirmation-content" }, We = /* @__PURE__ */ D("i", {
  class: "pi pi-exclamation-triangle p-mr-3",
  style: { "font-size": "2rem" }
}, null, -1), Je = { key: 0 }, de = {
  __name: "PVTables",
  props: {
    table: {
      type: String,
      required: !0
    },
    actions: {
      type: Object
    },
    reload: {
      type: Boolean
    },
    filters: {
      type: Object,
      default: {}
    }
  },
  emits: [
    "message"
  ],
  setup(B, { expose: Y, emit: ue }) {
    Re({
      name: "PVTables"
    });
    const v = B, _ = n(), Z = () => {
      let a = {};
      for (let i in p)
        if (v.filters.hasOwnProperty(i))
          a[i] = v.filters[i];
        else
          switch (p[i].type) {
            default:
              a[i] = { operator: re.AND, constraints: [{ value: null, matchMode: ne.STARTS_WITH }] };
          }
      _.value = a;
    }, ce = (a) => {
      b.value.filters = _.value, x(a);
    }, fe = () => {
      Z(), b.value.filters = _.value, x();
    }, me = (a) => "Поиск по " + a.label, pe = ue, f = {
      add: (a) => {
        pe("message", a);
      }
    }, $ = n(), S = n(!0), j = n(0), ee = n(0), b = n({}), N = n([
      { field: "id", label: "ID" }
    ]);
    let p = {};
    const h = n();
    let L = n([]);
    const q = n(!1), ve = n(!1), le = n([]);
    Me(async () => {
      S.value = !0, b.value = {
        first: $.value.first,
        rows: $.value.rows,
        sortField: null,
        sortOrder: null
        // filters: filters.value
      };
      try {
        const a = await U.options("/api/" + v.table);
        if (!a.data.success) {
          f.add({ severity: "error", summary: "Ошибка", detail: a.data.message, life: 3e3 });
          return;
        }
        if (a.data.data.hasOwnProperty("fields")) {
          p = a.data.data.fields;
          let i = [], s = [];
          for (let l in p)
            p[l].field = l, p[l].hasOwnProperty("label") || (p[l].label = l), p[l].hasOwnProperty("type") || (p[l].type = "text"), s.push(p[l]), i.push(l);
          le.value = i, Z();
          let e = a.data.data.actions;
          for (let l in v.actions)
            e[l] = v.actions[l];
          for (let l in e) {
            let t = { ...e[l] }, m = !0;
            switch (t.action = l, l) {
              case "update":
                t.hasOwnProperty("row") || (t.row = !0), t.hasOwnProperty("icon") || (t.icon = "pi pi-pencil"), t.hasOwnProperty("class") || (t.class = "p-button-rounded p-button-success"), t.hasOwnProperty("click") || (t.click = (C) => ke(C));
                break;
              case "delete":
                t.hasOwnProperty("row") || (t.row = !0), t.hasOwnProperty("head") || (t.head = !0), t.hasOwnProperty("icon") || (t.icon = "pi pi-trash"), t.hasOwnProperty("class") || (t.class = "p-button-rounded p-button-danger"), t.hasOwnProperty("click") || (t.click = (C) => Ue(C)), t.hasOwnProperty("head_click") || (t.head_click = () => _e()), t.hasOwnProperty("label") || (t.label = "Удалить");
                break;
              case "create":
                t.hasOwnProperty("head") || (t.head = !0), t.hasOwnProperty("icon") || (t.icon = "pi pi-plus"), t.hasOwnProperty("class") || (t.class = "p-button-rounded p-button-success"), t.hasOwnProperty("head_click") || (t.head_click = () => Oe()), t.hasOwnProperty("label") || (t.label = "Создать");
                break;
              case "subtables":
                m = !1;
                for (let C in e[l]) {
                  let y = { ...e[l][C] };
                  y.table = C, y.hasOwnProperty("row") || (y.row = !0), y.hasOwnProperty("icon") || (y.icon = "pi pi-angle-right"), y.hasOwnProperty("class") || (y.class = "p-button-rounded p-button-success"), y.hasOwnProperty("click") || (y.click = (Te) => ye(Te, y)), q.value = !0, L.value.push(y);
                }
                break;
            }
            m && (t.hasOwnProperty("row") && (q.value = !0), t.hasOwnProperty("row") && (ve.value = !0), L.value.push(t));
          }
          N.value = s;
        }
        x();
      } catch (a) {
        f.add({ severity: "error", summary: "Ошибка", detail: a.message, life: 3e3 }), console.error(a);
      }
    });
    const I = n({}), G = n({}), te = n({}), ae = async (a) => {
      I.value = { ...a };
    }, ye = async (a, i) => {
      let s = { ...I.value };
      if (s.hasOwnProperty(a.id))
        if (G.value[a.id] == i.table) {
          delete s[a.id], await ae(s);
          return;
        } else
          delete s[a.id], await ae(s), s[a.id] = !0;
      else
        s[a.id] = !0;
      if (G.value[a.id] = i.table, i.hasOwnProperty("where")) {
        let e = {};
        for (let l in i.where)
          e[l] = {
            operator: re.AND,
            constraints: [{
              value: a[i.where[l]],
              matchMode: ne.EQUALS
            }]
          };
        te.value[a.id] = e;
      }
      I.value = { ...s };
    }, x = (a) => {
      S.value = !0, b.value = { ...b.value, first: (a == null ? void 0 : a.first) || ee.value };
      let i = {
        limit: b.value.rows,
        setTotal: 1,
        offset: b.value.first,
        // sortField:lazyParams.value.sortField,
        // sortOrder:lazyParams.value.sortOrder,
        multiSortMeta: b.value.multiSortMeta,
        filters: _.value
      };
      U.get("/api/" + v.table, { params: i }).then(function(s) {
        if (!s.data.success) {
          f.add({ severity: "error", summary: "Ошибка", detail: s.data.message, life: 3e3 });
          return;
        }
        let e = [];
        s.data.data.rows.length && s.data.data.rows.forEach(function(l) {
          for (let t in p)
            switch (t == "id" && (l[t] = Number(l[t])), p[t].type) {
              case "boolean":
                l.hasOwnProperty(t) && (l[t] === "0" ? l[t] = !1 : l[t] = !0);
                break;
              case "number":
              case "decimal":
                l[t] = Number(l[t]);
                break;
            }
          e.push(l);
        }), h.value = e, j.value = s.data.data.total, S.value = !1;
      }).catch(function(s) {
        f.add({ severity: "error", summary: "Ошибка", detail: s.message, life: 3e3 });
      });
    }, ie = () => {
      x();
    };
    Y({ refresh: ie });
    const be = async (a) => {
      let { data: i, newValue: s, field: e } = a;
      try {
        const l = await U.patch("/api/" + v.table, { id: i.id, [e]: s });
        if (!l.data.success) {
          f.add({ severity: "error", summary: "Ошибка", detail: l.data.message, life: 3e3 });
          return;
        }
        l.data.success && (i[e] = s);
      } catch (l) {
        a.preventDefault(), f.add({ severity: "error", summary: "Ошибка", detail: l.message, life: 3e3 }), console.error(l);
      }
    }, he = (a) => {
      b.value = a, x(a);
    }, we = (a) => {
      b.value = a, x(a);
    }, ge = (a) => a.toString().replace(".", ","), r = n({}), H = n(!1), P = n(!1), ke = (a) => {
      r.value = { ...a }, P.value = !0;
    }, Ve = () => {
      P.value = !1, H.value = !1;
    }, xe = () => {
      H.value = !0, r.value.id ? U.patch("/api/" + v.table, r.value).then((a) => {
        if (!a.data.success) {
          f.add({ severity: "error", summary: "Ошибка", detail: a.data.message, life: 3e3 });
          return;
        }
        h.value[Pe(Number(r.value.id))] = r.value, P.value = !1, r.value = {};
      }).catch(function(a) {
        f.add({ severity: "error", summary: "Ошибка", detail: a.message, life: 3e3 });
      }) : U.put("/api/" + v.table, r.value).then((a) => {
        if (!a.data.success) {
          f.add({ severity: "error", summary: "Ошибка", detail: a.data.message, life: 3e3 });
          return;
        }
        S.value = !0, P.value = !1, r.value = {}, x();
      }).catch(function(a) {
        f.add({ severity: "error", summary: "Ошибка", detail: a.message, life: 3e3 });
      });
    }, Pe = (a) => {
      let i = -1;
      for (let s = 0; s < h.value.length; s++)
        if (h.value[s].id === a) {
          i = s;
          break;
        }
      return i;
    }, Oe = () => {
      r.value = {}, H.value = !1, P.value = !0;
    }, T = n(!1), R = n(!1), Ue = (a) => {
      r.value = a, T.value = !0;
    }, De = () => {
      U.delete("/api/" + v.table + "?ids=" + r.value.id).then((a) => {
        if (!a.data.success) {
          f.add({ severity: "error", summary: "Ошибка", detail: a.data.message, life: 3e3 });
          return;
        }
        h.value = h.value.filter((i) => i.id !== r.value.id), T.value = !1, r.value = {};
      }).catch(function(a) {
        f.add({ severity: "error", summary: "Ошибка", detail: a.message, life: 3e3 });
      });
    }, _e = () => {
      w.value && w.value.length && (R.value = !0);
    }, Ce = () => {
      let a = [];
      w.value.forEach(function(i) {
        a.push(i.id);
      }), U.delete("/api/" + v.table + "?ids=" + a.join(",")).then((i) => {
        if (!i.data.success) {
          f.add({ severity: "error", summary: "Ошибка", detail: i.data.message, life: 3e3 });
          return;
        }
        h.value = h.value.filter((s) => !w.value.includes(s)), R.value = !1, w.value = null;
      }).catch(function(i) {
        f.add({ severity: "error", summary: "Ошибка", detail: i.message, life: 3e3 });
      });
    }, w = n(), O = n(!1), Fe = (a) => {
      O.value = a.checked, O.value ? (O.value = !0, w.value = h.value) : (O.value = !1, w.value = []);
    }, Se = () => {
      O.value = w.value.length === j.value;
    }, Ie = () => {
      O.value = !1;
    };
    return (a, i) => {
      const s = Ne("PVTables", !0);
      return c(), g("div", ze, [
        d(o(Ee), { class: "p-mb-4" }, {
          start: u(() => [
            (c(!0), g(M, null, A(o(L).filter((e) => e.head), (e) => (c(), k(o(V), {
              icon: e.icon,
              label: e.label,
              class: oe(e.class),
              onClick: e.head_click
            }, null, 8, ["icon", "label", "class", "onClick"]))), 256))
          ]),
          end: u(() => [
            d(o(V), {
              icon: "pi pi-refresh",
              class: "p-button-rounded p-button-success",
              onClick: ie
            }),
            d(o(V), {
              type: "button",
              icon: "pi pi-filter-slash",
              onClick: i[0] || (i[0] = (e) => fe())
            })
          ]),
          _: 1
        }),
        d(o(Ae), {
          value: h.value,
          lazy: "",
          paginator: "",
          first: ee.value,
          rows: 10,
          rowsPerPageOptions: [10, 60, 30, 10],
          ref_key: "dt",
          ref: $,
          dataKey: "id",
          totalRecords: j.value,
          loading: S.value,
          onPage: i[1] || (i[1] = (e) => he(e)),
          onSort: i[2] || (i[2] = (e) => we(e)),
          sortMode: "multiple",
          editMode: "cell",
          onCellEditComplete: be,
          selection: w.value,
          "onUpdate:selection": i[3] || (i[3] = (e) => w.value = e),
          selectAll: O.value,
          onSelectAllChange: Fe,
          onRowSelect: Se,
          onRowUnselect: Ie,
          filters: _.value,
          "onUpdate:filters": i[4] || (i[4] = (e) => _.value = e),
          filterDisplay: "menu",
          globalFilterFields: le.value,
          onFilter: i[5] || (i[5] = (e) => ce(e)),
          expandedRows: I.value,
          "onUpdate:expandedRows": i[6] || (i[6] = (e) => I.value = e),
          showGridlines: ""
        }, {
          expansion: u((e) => [
            D("div", Be, [
              D("h5", null, "Orders for " + F(e.data.id), 1),
              d(s, {
                table: G.value[e.data.id],
                filters: te.value[e.data.id]
              }, null, 8, ["table", "filters"])
            ])
          ]),
          default: u(() => [
            d(o(E), {
              selectionMode: "multiple",
              headerStyle: "width: 3rem"
            }),
            (c(!0), g(M, null, A(N.value.filter((e) => e.modal_only != !0), (e) => (c(), g(M, {
              key: e.field
            }, [
              e.field == "id" ? (c(), k(o(E), {
                key: 0,
                field: "id",
                header: "id",
                style: { padding: "1rem 10px 1rem 10px" },
                sortable: ""
              }, {
                body: u(({ data: l, field: t }) => [
                  K(F(l[t]), 1)
                ]),
                _: 1
              })) : (c(), k(o(E), {
                key: 1,
                field: e.field,
                header: e.label,
                style: { "min-width": "12rem" },
                sortable: ""
              }, Le({
                filter: u(({ filterModel: l }) => [
                  d(o(J), {
                    modelValue: l.value,
                    "onUpdate:modelValue": (t) => l.value = t,
                    type: "text",
                    class: "p-column-filter",
                    placeholder: me(e)
                  }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"])
                ]),
                _: 2
              }, [
                e.type == "decimal" ? {
                  name: "body",
                  fn: u(({ data: l, field: t }) => [
                    K(F(ge(l[t])), 1)
                  ]),
                  key: "0"
                } : e.type == "boolean" ? {
                  name: "body",
                  fn: u(({ data: l, field: t }) => [
                    d(o(X), {
                      modelValue: l[t],
                      "onUpdate:modelValue": (m) => l[t] = m
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  key: "1"
                } : {
                  name: "body",
                  fn: u(({ data: l, field: t }) => [
                    K(F(l[t]), 1)
                  ]),
                  key: "2"
                },
                e.type == "textarea" ? {
                  name: "editor",
                  fn: u(({ data: l, field: t }) => [
                    d(o(se), {
                      modelValue: l[t],
                      "onUpdate:modelValue": (m) => l[t] = m,
                      rows: "1"
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  key: "3"
                } : e.type == "number" ? {
                  name: "editor",
                  fn: u(({ data: l, field: t }) => [
                    d(o(z), {
                      modelValue: l[t],
                      "onUpdate:modelValue": (m) => l[t] = m
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  key: "4"
                } : e.type == "decimal" ? {
                  name: "editor",
                  fn: u(({ data: l, field: t }) => [
                    d(o(z), {
                      modelValue: l[t],
                      "onUpdate:modelValue": (m) => l[t] = m,
                      minFractionDigits: e.FractionDigits,
                      maxFractionDigits: e.FractionDigits
                    }, null, 8, ["modelValue", "onUpdate:modelValue", "minFractionDigits", "maxFractionDigits"])
                  ]),
                  key: "5"
                } : e.type == "boolean" ? {
                  name: "editor",
                  fn: u(({ data: l, field: t }) => [
                    d(o(X), {
                      modelValue: l[t],
                      "onUpdate:modelValue": (m) => l[t] = m
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  key: "6"
                } : {
                  name: "editor",
                  fn: u(({ data: l, field: t }) => [
                    d(o(J), {
                      modelValue: l[t],
                      "onUpdate:modelValue": (m) => l[t] = m
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  key: "7"
                }
              ]), 1032, ["field", "header"]))
            ], 64))), 128)),
            q.value ? (c(), k(o(E), {
              key: 0,
              exportable: !1,
              style: { "white-space": "nowrap" }
            }, {
              body: u((e) => [
                (c(!0), g(M, null, A(o(L).filter((l) => l.row), (l) => (c(), k(o(V), {
                  icon: l.icon,
                  class: oe(l.class),
                  onClick: (t) => l.click(e.data, N.value)
                }, null, 8, ["icon", "class", "onClick"]))), 256))
              ]),
              _: 1
            })) : Q("", !0)
          ]),
          _: 1
        }, 8, ["value", "first", "totalRecords", "loading", "selection", "selectAll", "filters", "globalFilterFields", "expandedRows"]),
        d(o(W), {
          visible: P.value,
          "onUpdate:visible": i[7] || (i[7] = (e) => P.value = e),
          style: { width: "450px" },
          header: "Редактировать",
          modal: !0,
          class: "p-fluid"
        }, {
          footer: u(() => [
            d(o(V), {
              label: "Отмена",
              icon: "pi pi-times",
              class: "p-button-text",
              onClick: Ve
            }),
            d(o(V), {
              label: "Сохранить",
              icon: "pi pi-check",
              class: "p-button-text",
              onClick: xe
            })
          ]),
          default: u(() => [
            (c(!0), g(M, null, A(N.value.filter((e) => e.table_only != !0), (e) => (c(), g("div", $e, [
              D("label", {
                for: e.field
              }, F(e.label), 9, je),
              e.field == "id" ? (c(), g("p", {
                key: 0,
                id: e.field
              }, F(r.value[e.field]), 9, qe)) : e.type == "textarea" ? (c(), k(o(se), {
                key: 1,
                id: e.field,
                modelValue: r.value[e.field],
                "onUpdate:modelValue": (l) => r.value[e.field] = l,
                modelModifiers: { trim: !0 }
              }, null, 8, ["id", "modelValue", "onUpdate:modelValue"])) : e.type == "number" ? (c(), k(o(z), {
                key: 2,
                id: e.field,
                modelValue: r.value[e.field],
                "onUpdate:modelValue": (l) => r.value[e.field] = l
              }, null, 8, ["id", "modelValue", "onUpdate:modelValue"])) : e.type == "decimal" ? (c(), k(o(z), {
                key: 3,
                id: e.field,
                modelValue: r.value[e.field],
                "onUpdate:modelValue": (l) => r.value[e.field] = l,
                minFractionDigits: e.FractionDigits,
                maxFractionDigits: e.FractionDigits
              }, null, 8, ["id", "modelValue", "onUpdate:modelValue", "minFractionDigits", "maxFractionDigits"])) : e.type == "boolean" ? (c(), k(o(X), {
                key: 4,
                id: e.field,
                modelValue: r.value[e.field],
                "onUpdate:modelValue": (l) => r.value[e.field] = l
              }, null, 8, ["id", "modelValue", "onUpdate:modelValue"])) : (c(), k(o(J), {
                key: 5,
                id: e.field,
                modelValue: r.value[e.field],
                "onUpdate:modelValue": (l) => r.value[e.field] = l,
                modelModifiers: { trim: !0 }
              }, null, 8, ["id", "modelValue", "onUpdate:modelValue"]))
            ]))), 256))
          ]),
          _: 1
        }, 8, ["visible"]),
        d(o(W), {
          visible: T.value,
          "onUpdate:visible": i[9] || (i[9] = (e) => T.value = e),
          style: { width: "450px" },
          header: "Confirm",
          modal: !0
        }, {
          footer: u(() => [
            d(o(V), {
              label: "Нет",
              icon: "pi pi-times",
              class: "p-button-text",
              onClick: i[8] || (i[8] = (e) => T.value = !1)
            }),
            d(o(V), {
              label: "Да",
              icon: "pi pi-check",
              class: "p-button-text",
              onClick: De
            })
          ]),
          default: u(() => [
            D("div", Ge, [
              He,
              r.value ? (c(), g("span", Ke, "Вы хотите удалить эту запись?")) : Q("", !0)
            ])
          ]),
          _: 1
        }, 8, ["visible"]),
        d(o(W), {
          visible: R.value,
          "onUpdate:visible": i[11] || (i[11] = (e) => R.value = e),
          style: { width: "450px" },
          header: "Confirm",
          modal: !0
        }, {
          footer: u(() => [
            d(o(V), {
              label: "Нет",
              icon: "pi pi-times",
              class: "p-button-text",
              onClick: i[10] || (i[10] = (e) => R.value = !1)
            }),
            d(o(V), {
              label: "Да",
              icon: "pi pi-check",
              class: "p-button-text",
              onClick: Ce
            })
          ]),
          default: u(() => [
            D("div", Qe, [
              We,
              r.value ? (c(), g("span", Je, "Вы хотите удалить отмеченные записи?")) : Q("", !0)
            ])
          ]),
          _: 1
        }, 8, ["visible"])
      ]);
    };
  }
}, dl = {
  install: (B, Y) => {
    B.component(de.name, de);
  }
};
export {
  de as PVTables,
  dl as default
};
