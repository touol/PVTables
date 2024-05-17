import { mergeModels as pe, useModel as Ne, ref as u, onBeforeMount as Ee, openBlock as p, createBlock as h, unref as i, withCtx as d, createVNode as r, withKeys as he, defineComponent as Le, onMounted as Be, resolveComponent as ze, createElementBlock as U, Fragment as E, renderList as q, normalizeClass as ce, createElementVNode as T, createTextVNode as te, toDisplayString as L, createSlots as Ke, createCommentVNode as le } from "vue";
import $e from "primevue/datatable";
import B from "primevue/column";
import O from "primevue/button";
import je from "primevue/toolbar";
import ae from "primevue/dialog";
import C from "axios";
import Q from "primevue/inputtext";
import me from "primevue/textarea";
import H from "primevue/inputnumber";
import oe from "primevue/inputswitch";
import Ge from "primevue/autocomplete";
import qe from "primevue/inputgroup";
import { FilterOperator as fe, FilterMatchMode as ve } from "primevue/api";
const ye = {
  __name: "GTSAutocomplete",
  props: /* @__PURE__ */ pe({
    table: {
      type: String,
      required: !0
    }
  }, {
    id: {
      type: String,
      default: ""
    },
    idModifiers: {}
  }),
  emits: /* @__PURE__ */ pe(["update:id"], ["update:id"]),
  setup(S, { emit: W }) {
    const _ = Ne(S, "id"), y = S, w = u({}), z = (v) => {
      _.value = v.value.id;
    }, K = u([]), J = async ({ query: v }) => {
      try {
        const c = await C.post(
          "/api/" + y.table,
          {},
          {
            params: {
              api_action: "autocomplete",
              query: v
            }
          }
        );
        K.value = c.data.data.rows;
      } catch (c) {
        console.log(`Autocomplete search error: 
`, c);
      }
    };
    async function $(v) {
      return (await C.post(
        "/api/" + y.table,
        {},
        {
          params: {
            api_action: "autocomplete",
            id: v
          }
        }
      )).data.data.rows[0] || null;
    }
    const X = [null, "", "0"];
    Ee(async () => {
      if (X.includes(_.value))
        _.value = "";
      else {
        const v = await $(_.value);
        w.value = v;
      }
    });
    const m = async (v) => {
      const c = v.target.value;
      let V = {};
      c !== "" && c !== "0" && (V = await $(v.target.value)), w.value = V, _.value = c;
    };
    return (v, c) => (p(), h(i(qe), null, {
      default: d(() => [
        r(i(Q), {
          modelValue: _.value,
          "onUpdate:modelValue": c[0] || (c[0] = (V) => _.value = V),
          onBlur: m,
          onKeydown: he(m, ["enter"])
        }, null, 8, ["modelValue"]),
        r(i(Ge), {
          modelValue: w.value,
          "onUpdate:modelValue": c[1] || (c[1] = (V) => w.value = V),
          onItemSelect: z,
          dropdown: "",
          onComplete: J,
          "option-label": "content",
          suggestions: K.value
        }, null, 8, ["modelValue", "suggestions"])
      ]),
      _: 1
    }));
  }
}, He = { class: "card" }, Qe = { class: "p-3" }, We = { class: "p-field" }, Je = ["for"], Xe = ["id"], Ye = { class: "confirmation-content" }, Ze = /* @__PURE__ */ T("i", {
  class: "pi pi-exclamation-triangle p-mr-3",
  style: { "font-size": "2rem" }
}, null, -1), et = { key: 0 }, tt = { class: "confirmation-content" }, lt = /* @__PURE__ */ T("i", {
  class: "pi pi-exclamation-triangle p-mr-3",
  style: { "font-size": "2rem" }
}, null, -1), at = { key: 0 }, be = {
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
  emits: ["message"],
  setup(S, { expose: W, emit: _ }) {
    Le({
      name: "PVTables"
    });
    const y = S, w = u(), z = () => {
      let a = {};
      for (let o in b)
        if (y.filters.hasOwnProperty(o))
          a[o] = y.filters[o];
        else
          switch (b[o].type) {
            default:
              a[o] = {
                operator: fe.AND,
                constraints: [
                  { value: null, matchMode: ve.STARTS_WITH }
                ]
              };
          }
      w.value = a;
    }, K = (a) => {
      k.value.filters = w.value, D(a);
    }, J = () => {
      z(), k.value.filters = w.value, D();
    }, $ = (a) => "Поиск по " + a.label, X = _, m = {
      add: (a) => {
        X("message", a);
      }
    }, v = u(), c = u(!0), V = u(0), ie = u(0), k = u({}), j = u([{ field: "id", label: "ID" }]);
    let b = {};
    const x = u();
    let G = u([]);
    const Y = u(!1), we = u(!1), se = u([]);
    Be(async () => {
      c.value = !0, k.value = {
        first: v.value.first,
        rows: v.value.rows,
        sortField: null,
        sortOrder: null
        // filters: filters.value
      };
      try {
        const a = await C.post(
          "/api/" + y.table,
          {},
          {
            params: {
              api_action: "options"
            }
          }
        );
        if (!a.data.success) {
          m.add({
            severity: "error",
            summary: "Ошибка",
            detail: a.data.message,
            life: 3e3
          });
          return;
        }
        if (a.data.data.hasOwnProperty("fields")) {
          b = a.data.data.fields;
          let o = [], s = [];
          for (let t in b)
            b[t].field = t, b[t].hasOwnProperty("label") || (b[t].label = t), b[t].hasOwnProperty("type") || (b[t].type = "text"), s.push(b[t]), o.push(t);
          se.value = o, z();
          let e = a.data.data.actions;
          for (let t in y.actions)
            e[t] = y.actions[t];
          for (let t in e) {
            let l = { ...e[t] }, f = !0;
            switch (l.action = t, t) {
              case "update":
                l.hasOwnProperty("row") || (l.row = !0), l.hasOwnProperty("icon") || (l.icon = "pi pi-pencil"), l.hasOwnProperty("class") || (l.class = "p-button-rounded p-button-success"), l.hasOwnProperty("click") || (l.click = (M) => Pe(M));
                break;
              case "delete":
                l.hasOwnProperty("row") || (l.row = !0), l.hasOwnProperty("head") || (l.head = !0), l.hasOwnProperty("icon") || (l.icon = "pi pi-trash"), l.hasOwnProperty("class") || (l.class = "p-button-rounded p-button-danger"), l.hasOwnProperty("click") || (l.click = (M) => De(M)), l.hasOwnProperty("head_click") || (l.head_click = () => Ie()), l.hasOwnProperty("label") || (l.label = "Удалить");
                break;
              case "create":
                l.hasOwnProperty("head") || (l.head = !0), l.hasOwnProperty("icon") || (l.icon = "pi pi-plus"), l.hasOwnProperty("class") || (l.class = "p-button-rounded p-button-success"), l.hasOwnProperty("head_click") || (l.head_click = () => Ce()), l.hasOwnProperty("label") || (l.label = "Создать");
                break;
              case "subtables":
                f = !1;
                for (let M in e[t]) {
                  let g = { ...e[t][M] };
                  g.table = M, g.hasOwnProperty("row") || (g.row = !0), g.hasOwnProperty("icon") || (g.icon = "pi pi-angle-right"), g.hasOwnProperty("class") || (g.class = "p-button-rounded p-button-success"), g.hasOwnProperty("click") || (g.click = (Re) => ge(Re, g)), Y.value = !0, G.value.push(g);
                }
                break;
            }
            f && (l.hasOwnProperty("row") && (Y.value = !0), l.hasOwnProperty("row") && (we.value = !0), G.value.push(l));
          }
          j.value = s;
        }
        D();
      } catch (a) {
        m.add({
          severity: "error",
          summary: "Ошибка",
          detail: a.message,
          life: 3e3
        }), console.error(a);
      }
    });
    const A = u({}), Z = u({}), ne = u({}), re = async (a) => {
      A.value = { ...a };
    }, ge = async (a, o) => {
      let s = { ...A.value };
      if (s.hasOwnProperty(a.id))
        if (Z.value[a.id] == o.table) {
          delete s[a.id], await re(s);
          return;
        } else
          delete s[a.id], await re(s), s[a.id] = !0;
      else
        s[a.id] = !0;
      if (Z.value[a.id] = o.table, o.hasOwnProperty("where")) {
        let e = {};
        for (let t in o.where)
          e[t] = {
            operator: fe.AND,
            constraints: [
              {
                value: a[o.where[t]],
                matchMode: ve.EQUALS
              }
            ]
          };
        ne.value[a.id] = e;
      }
      A.value = { ...s };
    }, D = (a) => {
      c.value = !0, k.value = {
        ...k.value,
        first: (a == null ? void 0 : a.first) || ie.value
      };
      let o = {
        limit: k.value.rows,
        setTotal: 1,
        offset: k.value.first,
        // sortField:lazyParams.value.sortField,
        // sortOrder:lazyParams.value.sortOrder,
        multiSortMeta: k.value.multiSortMeta,
        filters: w.value
      };
      C.get("/api/" + y.table, { params: o }).then(function(s) {
        if (!s.data.success) {
          m.add({
            severity: "error",
            summary: "Ошибка",
            detail: s.data.message,
            life: 3e3
          });
          return;
        }
        let e = [];
        s.data.data.rows.length && s.data.data.rows.forEach(function(t) {
          for (let l in b)
            switch (l == "id" && (t[l] = Number(t[l])), b[l].type) {
              case "boolean":
                t.hasOwnProperty(l) && (t[l] === "0" ? t[l] = !1 : t[l] = !0);
                break;
              case "number":
              case "decimal":
                t[l] = Number(t[l]);
                break;
            }
          e.push(t);
        }), x.value = e, V.value = s.data.data.total, c.value = !1;
      }).catch(function(s) {
        m.add({
          severity: "error",
          summary: "Ошибка",
          detail: s.message,
          life: 3e3
        });
      });
    }, de = () => {
      D();
    };
    W({ refresh: de });
    const ue = async (a) => {
      let { data: o, newValue: s, field: e } = a;
      try {
        const t = await C.patch("/api/" + y.table, {
          id: o.id,
          [e]: s
        });
        if (!t.data.success) {
          m.add({
            severity: "error",
            summary: "Ошибка",
            detail: t.data.message,
            life: 3e3
          });
          return;
        }
        t.data.success && (o[e] = s);
      } catch (t) {
        a.preventDefault(), m.add({
          severity: "error",
          summary: "Ошибка",
          detail: t.message,
          life: 3e3
        }), console.error(t);
      }
    }, Ve = (a) => {
      k.value = a, D(a);
    }, ke = (a) => {
      k.value = a, D(a);
    }, xe = (a) => a.toString().replace(".", ","), n = u({}), ee = u(!1), F = u(!1), Pe = (a) => {
      n.value = { ...a }, F.value = !0;
    }, Ue = () => {
      F.value = !1, ee.value = !1;
    }, Oe = () => {
      ee.value = !0, n.value.id ? C.patch("/api/" + y.table, n.value).then((a) => {
        if (!a.data.success) {
          m.add({
            severity: "error",
            summary: "Ошибка",
            detail: a.data.message,
            life: 3e3
          });
          return;
        }
        x.value[_e(Number(n.value.id))] = n.value, F.value = !1, n.value = {};
      }).catch(function(a) {
        m.add({
          severity: "error",
          summary: "Ошибка",
          detail: a.message,
          life: 3e3
        });
      }) : C.put("/api/" + y.table, n.value).then((a) => {
        if (!a.data.success) {
          m.add({
            severity: "error",
            summary: "Ошибка",
            detail: a.data.message,
            life: 3e3
          });
          return;
        }
        c.value = !0, F.value = !1, n.value = {}, D();
      }).catch(function(a) {
        m.add({
          severity: "error",
          summary: "Ошибка",
          detail: a.message,
          life: 3e3
        });
      });
    }, _e = (a) => {
      let o = -1;
      for (let s = 0; s < x.value.length; s++)
        if (x.value[s].id === a) {
          o = s;
          break;
        }
      return o;
    }, Ce = () => {
      n.value = {}, ee.value = !1, F.value = !0;
    }, R = u(!1), N = u(!1), De = (a) => {
      n.value = a, R.value = !0;
    }, Fe = () => {
      C.delete("/api/" + y.table + "?ids=" + n.value.id).then((a) => {
        if (!a.data.success) {
          m.add({
            severity: "error",
            summary: "Ошибка",
            detail: a.data.message,
            life: 3e3
          });
          return;
        }
        x.value = x.value.filter(
          (o) => o.id !== n.value.id
        ), R.value = !1, n.value = {};
      }).catch(function(a) {
        m.add({
          severity: "error",
          summary: "Ошибка",
          detail: a.message,
          life: 3e3
        });
      });
    }, Ie = () => {
      P.value && P.value.length && (N.value = !0);
    }, Se = () => {
      let a = [];
      P.value.forEach(function(o) {
        a.push(o.id);
      }), C.delete("/api/" + y.table + "?ids=" + a.join(",")).then((o) => {
        if (!o.data.success) {
          m.add({
            severity: "error",
            summary: "Ошибка",
            detail: o.data.message,
            life: 3e3
          });
          return;
        }
        x.value = x.value.filter(
          (s) => !P.value.includes(s)
        ), N.value = !1, P.value = null;
      }).catch(function(o) {
        m.add({
          severity: "error",
          summary: "Ошибка",
          detail: o.message,
          life: 3e3
        });
      });
    }, P = u(), I = u(!1), Me = (a) => {
      I.value = a.checked, I.value ? (I.value = !0, P.value = x.value) : (I.value = !1, P.value = []);
    }, Te = () => {
      I.value = P.value.length === V.value;
    }, Ae = () => {
      I.value = !1;
    };
    return (a, o) => {
      const s = ze("PVTables", !0);
      return p(), U("div", He, [
        r(i(je), { class: "p-mb-4" }, {
          start: d(() => [
            (p(!0), U(E, null, q(i(G).filter((e) => e.head), (e) => (p(), h(i(O), {
              icon: e.icon,
              label: e.label,
              class: ce(e.class),
              onClick: e.head_click
            }, null, 8, ["icon", "label", "class", "onClick"]))), 256))
          ]),
          end: d(() => [
            r(i(O), {
              icon: "pi pi-refresh",
              class: "p-button-rounded p-button-success",
              onClick: de
            }),
            r(i(O), {
              type: "button",
              icon: "pi pi-filter-slash",
              onClick: o[0] || (o[0] = (e) => J())
            })
          ]),
          _: 1
        }),
        r(i($e), {
          value: x.value,
          lazy: "",
          paginator: "",
          first: ie.value,
          rows: 10,
          rowsPerPageOptions: [10, 60, 30, 10],
          ref_key: "dt",
          ref: v,
          dataKey: "id",
          totalRecords: V.value,
          loading: c.value,
          onPage: o[1] || (o[1] = (e) => Ve(e)),
          onSort: o[2] || (o[2] = (e) => ke(e)),
          sortMode: "multiple",
          editMode: "cell",
          onCellEditComplete: ue,
          selection: P.value,
          "onUpdate:selection": o[3] || (o[3] = (e) => P.value = e),
          selectAll: I.value,
          onSelectAllChange: Me,
          onRowSelect: Te,
          onRowUnselect: Ae,
          filters: w.value,
          "onUpdate:filters": o[4] || (o[4] = (e) => w.value = e),
          filterDisplay: "menu",
          globalFilterFields: se.value,
          onFilter: o[5] || (o[5] = (e) => K(e)),
          expandedRows: A.value,
          "onUpdate:expandedRows": o[6] || (o[6] = (e) => A.value = e),
          showGridlines: ""
        }, {
          expansion: d((e) => [
            T("div", Qe, [
              r(s, {
                table: Z.value[e.data.id],
                filters: ne.value[e.data.id]
              }, null, 8, ["table", "filters"])
            ])
          ]),
          default: d(() => [
            r(i(B), {
              selectionMode: "multiple",
              headerStyle: "width: 3rem"
            }),
            (p(!0), U(E, null, q(j.value.filter((e) => e.modal_only != !0), (e) => (p(), U(E, {
              key: e.field
            }, [
              e.field == "id" ? (p(), h(i(B), {
                key: 0,
                field: "id",
                header: "id",
                style: { padding: "1rem 10px 1rem 10px" },
                sortable: ""
              }, {
                body: d(({ data: t, field: l }) => [
                  te(L(t[l]), 1)
                ]),
                _: 1
              })) : e.type == "autocomplete" ? (p(), h(i(B), {
                key: 1,
                field: e.field,
                header: e.label,
                style: { "min-width": "350px" }
              }, {
                body: d(({ data: t, field: l }) => [
                  r(ye, {
                    table: e.table,
                    id: t[l],
                    "onUpdate:id": (f) => t[l] = f,
                    onKeydown: he((f) => ue({ data: t, field: l, newValue: t[l] }), ["enter"])
                  }, null, 8, ["table", "id", "onUpdate:id", "onKeydown"])
                ]),
                _: 2
              }, 1032, ["field", "header"])) : (p(), h(i(B), {
                key: 2,
                field: e.field,
                header: e.label,
                style: { "min-width": "12rem" },
                sortable: ""
              }, Ke({
                filter: d(({ filterModel: t }) => [
                  r(i(Q), {
                    modelValue: t.value,
                    "onUpdate:modelValue": (l) => t.value = l,
                    type: "text",
                    class: "p-column-filter",
                    placeholder: $(e)
                  }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"])
                ]),
                _: 2
              }, [
                e.type == "decimal" ? {
                  name: "body",
                  fn: d(({ data: t, field: l }) => [
                    te(L(xe(t[l])), 1)
                  ]),
                  key: "0"
                } : e.type == "autocomplete" ? {
                  name: "body",
                  fn: d(() => [
                    r(ye, {
                      table: e.table
                    }, null, 8, ["table"])
                  ]),
                  key: "1"
                } : e.type == "boolean" ? {
                  name: "body",
                  fn: d(({ data: t, field: l }) => [
                    r(i(oe), {
                      modelValue: t[l],
                      "onUpdate:modelValue": (f) => t[l] = f
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  key: "2"
                } : {
                  name: "body",
                  fn: d(({ data: t, field: l }) => [
                    te(L(t[l]), 1)
                  ]),
                  key: "3"
                },
                e.type == "textarea" ? {
                  name: "editor",
                  fn: d(({ data: t, field: l }) => [
                    r(i(me), {
                      modelValue: t[l],
                      "onUpdate:modelValue": (f) => t[l] = f,
                      rows: "1"
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  key: "4"
                } : e.type == "number" ? {
                  name: "editor",
                  fn: d(({ data: t, field: l }) => [
                    r(i(H), {
                      modelValue: t[l],
                      "onUpdate:modelValue": (f) => t[l] = f
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  key: "5"
                } : e.type == "decimal" ? {
                  name: "editor",
                  fn: d(({ data: t, field: l }) => [
                    r(i(H), {
                      modelValue: t[l],
                      "onUpdate:modelValue": (f) => t[l] = f,
                      minFractionDigits: e.FractionDigits,
                      maxFractionDigits: e.FractionDigits
                    }, null, 8, ["modelValue", "onUpdate:modelValue", "minFractionDigits", "maxFractionDigits"])
                  ]),
                  key: "6"
                } : e.type == "boolean" ? {
                  name: "editor",
                  fn: d(({ data: t, field: l }) => [
                    r(i(oe), {
                      modelValue: t[l],
                      "onUpdate:modelValue": (f) => t[l] = f
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  key: "7"
                } : {
                  name: "editor",
                  fn: d(({ data: t, field: l }) => [
                    r(i(Q), {
                      modelValue: t[l],
                      "onUpdate:modelValue": (f) => t[l] = f
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])
                  ]),
                  key: "8"
                }
              ]), 1032, ["field", "header"]))
            ], 64))), 128)),
            Y.value ? (p(), h(i(B), {
              key: 0,
              exportable: !1,
              style: { "white-space": "nowrap" }
            }, {
              body: d((e) => [
                (p(!0), U(E, null, q(i(G).filter((t) => t.row), (t) => (p(), h(i(O), {
                  icon: t.icon,
                  class: ce(t.class),
                  onClick: (l) => t.click(e.data, j.value)
                }, null, 8, ["icon", "class", "onClick"]))), 256))
              ]),
              _: 1
            })) : le("", !0)
          ]),
          _: 1
        }, 8, ["value", "first", "totalRecords", "loading", "selection", "selectAll", "filters", "globalFilterFields", "expandedRows"]),
        r(i(ae), {
          visible: F.value,
          "onUpdate:visible": o[7] || (o[7] = (e) => F.value = e),
          style: { width: "450px" },
          header: "Редактировать",
          modal: !0,
          class: "p-fluid"
        }, {
          footer: d(() => [
            r(i(O), {
              label: "Отмена",
              icon: "pi pi-times",
              class: "p-button-text",
              onClick: Ue
            }),
            r(i(O), {
              label: "Сохранить",
              icon: "pi pi-check",
              class: "p-button-text",
              onClick: Oe
            })
          ]),
          default: d(() => [
            (p(!0), U(E, null, q(j.value.filter((e) => e.table_only != !0), (e) => (p(), U("div", We, [
              T("label", {
                for: e.field
              }, L(e.label), 9, Je),
              e.field == "id" ? (p(), U("p", {
                key: 0,
                id: e.field
              }, L(n.value[e.field]), 9, Xe)) : e.type == "textarea" ? (p(), h(i(me), {
                key: 1,
                id: e.field,
                modelValue: n.value[e.field],
                "onUpdate:modelValue": (t) => n.value[e.field] = t,
                modelModifiers: { trim: !0 }
              }, null, 8, ["id", "modelValue", "onUpdate:modelValue"])) : e.type == "number" ? (p(), h(i(H), {
                key: 2,
                id: e.field,
                modelValue: n.value[e.field],
                "onUpdate:modelValue": (t) => n.value[e.field] = t
              }, null, 8, ["id", "modelValue", "onUpdate:modelValue"])) : e.type == "decimal" ? (p(), h(i(H), {
                key: 3,
                id: e.field,
                modelValue: n.value[e.field],
                "onUpdate:modelValue": (t) => n.value[e.field] = t,
                minFractionDigits: e.FractionDigits,
                maxFractionDigits: e.FractionDigits
              }, null, 8, ["id", "modelValue", "onUpdate:modelValue", "minFractionDigits", "maxFractionDigits"])) : e.type == "boolean" ? (p(), h(i(oe), {
                key: 4,
                id: e.field,
                modelValue: n.value[e.field],
                "onUpdate:modelValue": (t) => n.value[e.field] = t
              }, null, 8, ["id", "modelValue", "onUpdate:modelValue"])) : (p(), h(i(Q), {
                key: 5,
                id: e.field,
                modelValue: n.value[e.field],
                "onUpdate:modelValue": (t) => n.value[e.field] = t,
                modelModifiers: { trim: !0 }
              }, null, 8, ["id", "modelValue", "onUpdate:modelValue"]))
            ]))), 256))
          ]),
          _: 1
        }, 8, ["visible"]),
        r(i(ae), {
          visible: R.value,
          "onUpdate:visible": o[9] || (o[9] = (e) => R.value = e),
          style: { width: "450px" },
          header: "Confirm",
          modal: !0
        }, {
          footer: d(() => [
            r(i(O), {
              label: "Нет",
              icon: "pi pi-times",
              class: "p-button-text",
              onClick: o[8] || (o[8] = (e) => R.value = !1)
            }),
            r(i(O), {
              label: "Да",
              icon: "pi pi-check",
              class: "p-button-text",
              onClick: Fe
            })
          ]),
          default: d(() => [
            T("div", Ye, [
              Ze,
              n.value ? (p(), U("span", et, "Вы хотите удалить эту запись?")) : le("", !0)
            ])
          ]),
          _: 1
        }, 8, ["visible"]),
        r(i(ae), {
          visible: N.value,
          "onUpdate:visible": o[11] || (o[11] = (e) => N.value = e),
          style: { width: "450px" },
          header: "Confirm",
          modal: !0
        }, {
          footer: d(() => [
            r(i(O), {
              label: "Нет",
              icon: "pi pi-times",
              class: "p-button-text",
              onClick: o[10] || (o[10] = (e) => N.value = !1)
            }),
            r(i(O), {
              label: "Да",
              icon: "pi pi-check",
              class: "p-button-text",
              onClick: Se
            })
          ]),
          default: d(() => [
            T("div", tt, [
              lt,
              n.value ? (p(), U("span", at, "Вы хотите удалить отмеченные записи?")) : le("", !0)
            ])
          ]),
          _: 1
        }, 8, ["visible"])
      ]);
    };
  }
}, ht = {
  install: (S, W) => {
    S.component(be.name, be);
  }
};
export {
  be as PVTables,
  ht as default
};
