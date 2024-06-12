import { onMounted as Pe, reactive as ye, defineComponent as Be, ref as d, resolveComponent as Ge, openBlock as n, createElementBlock as P, createVNode as f, unref as o, withCtx as b, Fragment as D, renderList as Y, createBlock as m, normalizeClass as $, createCommentVNode as K, createTextVNode as ne, toDisplayString as B, createSlots as je, withKeys as He, withModifiers as Qe, createElementVNode as j } from "vue";
import qe from "primevue/datatable";
import I from "primevue/column";
import C from "primevue/button";
import We from "primevue/toolbar";
import re from "primevue/dialog";
import G from "primevue/inputtext";
import be from "primevue/textarea";
import Z from "primevue/inputnumber";
import he from "primevue/inputswitch";
import { FilterOperator as de, FilterMatchMode as ue } from "primevue/api";
import we from "pvtables/gtsdate";
import Ve from "pvtables/gtsautocomplete";
import ke from "pvtables/gtsselect";
import { useNotifications as Ye } from "pvtables/notify";
import { PVTabs as Ze } from "pvtables/pvtabs";
import Je from "pvtables/api";
const Xe = 3, el = () => {
  Pe(() => {
    document.addEventListener("keydown", (V) => {
      V.code === "KeyZ" && V.ctrlKey && v(), V.code === "KeyY" && V.ctrlKey && c();
    });
  });
  const y = ye({
    undo: [],
    redo: []
  }), g = ye({
    name: "",
    details: {}
  }), h = (V) => {
    y.undo.length === Xe && y.undo.shift(), y.undo.push(V);
  };
  function v() {
    y.undo.length !== 0 && (g.details = y.undo.pop(), g.name = "undo", g.details.isNew, y.redo.push(g.details));
  }
  function c() {
    y.redo.length !== 0 && (g.details = y.redo.pop(), g.name = "redo", g.details.isNew, y.undo.push(g.details));
  }
  return { undo: v, redo: c, cacheAction: h, cache: y };
}, ll = (y, g) => {
  let h = [];
  return y.length && y.forEach(function(v) {
    for (let c in g)
      switch (c == "id" && (v[c] = Number(v[c])), g[c].type) {
        case "boolean":
          v.hasOwnProperty(c) && (v[c] === "0" ? v[c] = !1 : v[c] = !0);
          break;
        case "number":
        case "decimal":
          v[c] = Number(v[c]);
          break;
      }
    h.push(v);
  }), h;
}, al = { class: "card" }, tl = {
  key: 0,
  class: "p-3"
}, il = {
  key: 1,
  class: "p-3"
}, ol = { class: "p-field" }, sl = ["for"], nl = ["id"], rl = { class: "confirmation-content" }, dl = /* @__PURE__ */ j("i", {
  class: "pi pi-exclamation-triangle p-mr-3",
  style: { "font-size": "2rem" }
}, null, -1), ul = { key: 0 }, pl = { class: "confirmation-content" }, cl = /* @__PURE__ */ j("i", {
  class: "pi pi-exclamation-triangle p-mr-3",
  style: { "font-size": "2rem" }
}, null, -1), fl = { key: 0 }, ge = {
  __name: "PVTables",
  props: {
    table: {
      type: String,
      required: !0
    },
    actions: {
      type: Object,
      default: {}
    },
    reload: {
      type: Boolean
    },
    filters: {
      type: Object,
      default: {}
    }
  },
  setup(y, { expose: g }) {
    Be({
      name: "PVTables"
    });
    const h = y, v = Je(h.table), { notify: c } = Ye(), V = d(), pe = () => {
      let t = {};
      for (let i in w)
        if (h.filters.hasOwnProperty(i))
          t[i] = h.filters[i];
        else
          switch (w[i].type) {
            default:
              t[i] = {
                operator: de.AND,
                constraints: [
                  { value: null, matchMode: ue.STARTS_WITH }
                ]
              };
          }
      for (let i in h.filters)
        t.hasOwnProperty(i) || (t[i] = h.filters[i]);
      V.value = t;
    }, Ue = async (t) => {
      U.value.filters = V.value, await R(t);
    }, xe = async () => {
      pe(), U.value.filters = V.value, await R();
    }, J = (t) => "Поиск по " + t.label, X = d(), H = d(!0), ee = d(0), ce = d(0), U = d({}), Q = d([{ field: "id", label: "ID" }]);
    let w = {};
    const x = d();
    let L = d([]);
    const q = d(!1), fe = d([]), le = d({});
    Pe(async () => {
      H.value = !0, U.value = {
        first: X.value.first,
        rows: X.value.rows,
        sortField: null,
        sortOrder: null
        // filters: filters.value
      };
      try {
        const t = await v.options();
        if (t.data.hasOwnProperty("fields")) {
          w = t.data.fields;
          let i = [], u = [];
          for (let l in w)
            w[l].field = l, w[l].hasOwnProperty("label") || (w[l].label = l), w[l].hasOwnProperty("type") || (w[l].type = "text"), w[l].hasOwnProperty("readonly") && (w[l].readonly === !0 || w[l].readonly == 1 ? w[l].readonly = !0 : w[l].readonly = !1), u.push(w[l]), i.push(l);
          fe.value = i, pe();
          let e = t.data.actions;
          if (h.actions.hasOwnProperty(h.table))
            for (let l in h.actions[h.table])
              e[l] = h.actions[h.table][l];
          for (let l in e) {
            let a = { ...e[l] }, s = !0;
            switch (a.action = l, l) {
              case "update":
                a.hasOwnProperty("row") || (a.row = !0), a.hasOwnProperty("icon") || (a.icon = "pi pi-pencil"), a.hasOwnProperty("class") || (a.class = "p-button-rounded p-button-success"), a.hasOwnProperty("click") || (a.click = (k) => De(k));
                break;
              case "delete":
                a.hasOwnProperty("row") || (a.row = !0), a.hasOwnProperty("head") || (a.head = !0), a.hasOwnProperty("icon") || (a.icon = "pi pi-trash"), a.hasOwnProperty("class") || (a.class = "p-button-rounded p-button-danger"), a.hasOwnProperty("click") || (a.click = (k) => Le(k)), a.hasOwnProperty("head_click") || (a.head_click = () => Ne()), a.hasOwnProperty("label") || (a.label = "Удалить");
                break;
              case "create":
                a.hasOwnProperty("head") || (a.head = !0), a.hasOwnProperty("icon") || (a.icon = "pi pi-plus"), a.hasOwnProperty("class") || (a.class = "p-button-rounded p-button-success"), a.hasOwnProperty("head_click") || (a.head_click = () => Ie()), a.hasOwnProperty("label") || (a.label = "Создать");
                break;
              case "subtables":
                s = !1;
                for (let k in e[l]) {
                  let p = { action: l, ...e[l][k] };
                  p.table = k, p.hasOwnProperty("row") || (p.row = !0), p.hasOwnProperty("icon") || (p.icon = "pi pi-angle-right"), p.hasOwnProperty("class") || (p.class = "p-button-rounded p-button-success"), p.hasOwnProperty("click") || (p.click = (se) => ve(se, p)), q.value = !0, L.value.push(p);
                }
                break;
              case "subtabs":
                s = !1;
                for (let k in e[l]) {
                  let p = { action: l, tabs: { ...e[l][k] } };
                  p.table = k, p.hasOwnProperty("row") || (p.row = !0), p.hasOwnProperty("icon") || (p.icon = "pi pi-angle-right"), p.hasOwnProperty("class") || (p.class = "p-button-rounded p-button-success"), p.hasOwnProperty("click") || (p.click = (se) => ve(se, p)), q.value = !0, L.value.push(p);
                }
                break;
            }
            s && (a.hasOwnProperty("row") && (q.value = !0), L.value.push(a));
          }
          t.data.selects && (le.value = t.data.selects), Q.value = u;
        }
        await R();
      } catch (t) {
        c("error", { detail: t.message }, !0);
      }
    });
    const A = d({}), _ = d({}), N = d({}), ae = (t) => {
      if (!t || t == h.table)
        R();
      else if (t && N.value)
        for (let i in N.value)
          N.value[i].refresh(t);
    };
    g({ refresh: ae });
    const T = d({}), me = async (t) => {
      A.value = { ...t };
    }, ve = async (t, i) => {
      let u = { ...A.value };
      if (u.hasOwnProperty(t.id))
        if (_.value[t.id].table == i.table) {
          delete u[t.id], await me(u);
          return;
        } else
          delete u[t.id], await me(u), u[t.id] = !0;
      else
        u[t.id] = !0;
      if (_.value[t.id] = i, i.action == "subtables") {
        if (i.hasOwnProperty("where")) {
          let e = {};
          for (let l in i.where)
            e[l] = {
              operator: de.AND,
              constraints: [
                {
                  value: t[i.where[l]],
                  matchMode: ue.EQUALS
                }
              ]
            };
          T.value[t.id] = e;
        }
      } else if (i.action == "subtabs") {
        for (let e in i.tabs)
          if (i.tabs[e].hasOwnProperty("where")) {
            let l = {};
            for (let a in i.tabs[e].where)
              l[a] = {
                operator: de.AND,
                constraints: [
                  {
                    value: t[i.tabs[e].where[a]] ? t[i.tabs[e].where[a]] : i.tabs[e].where[a],
                    matchMode: ue.EQUALS
                  }
                ]
              };
            T.value.hasOwnProperty(t.id) || (T.value[t.id] = {}), T.value[t.id][e] = l;
          }
      }
      A.value = { ...u };
    }, te = d({}), W = d({}), R = async (t) => {
      H.value = !0, U.value = {
        ...U.value,
        first: (t == null ? void 0 : t.first) || ce.value
      };
      let i = {};
      for (let e in V.value)
        V.value[e].constraints[0].value !== null && (i[e] = V.value[e]);
      let u = {
        limit: U.value.rows,
        setTotal: 1,
        offset: U.value.first,
        // sortField:lazyParams.value.sortField,
        // sortOrder:lazyParams.value.sortOrder,
        multiSortMeta: U.value.multiSortMeta,
        filters: i
      };
      try {
        const e = await v.read(u);
        if (x.value = ll(e.data.rows, w), e.data.autocomplete)
          for (let l in e.data.autocomplete)
            te.value[l] = e.data.autocomplete[l];
        e.data.row_setting && (W.value = e.data.row_setting), ee.value = e.data.total, H.value = !1;
      } catch (e) {
        c("error", { detail: e.message });
      }
    }, { cacheAction: Oe, cache: ml } = el(), M = async (t) => {
      let { data: i, newValue: u, field: e } = t;
      const l = {
        id: i.id,
        [e]: u
      };
      Oe({ type: "update", payload: l });
      try {
        (await v.update(l)).success && (i[e] = u);
      } catch (a) {
        c("error", { detail: a.message }, !0);
      }
    }, Ce = async (t) => {
      U.value = t, await R(t);
    }, Se = async (t) => {
      U.value = t, await R(t);
    }, Fe = (t) => parseFloat(t).toFixed(2).toString().replace(".", ","), r = d({}), ie = d(!1), S = d(!1), De = (t) => {
      r.value = { ...t }, S.value = !0;
    }, _e = () => {
      S.value = !1, ie.value = !1;
    }, Te = async () => {
      if (ie.value = !0, r.value.id)
        try {
          await v.update(r.value), x.value[Re(Number(r.value.id))] = r.value, S.value = !1, r.value = {};
        } catch (t) {
          c("error", { detail: t.message });
        }
      else
        try {
          await v.create(r.value), ae(), S.value = !1, r.value = {};
        } catch (t) {
          c("error", { detail: t.message });
        }
    }, Re = (t) => {
      let i = -1;
      for (let u = 0; u < x.value.length; u++)
        if (x.value[u].id === t) {
          i = u;
          break;
        }
      return i;
    }, Ie = () => {
      r.value = {}, ie.value = !1, S.value = !0;
    }, E = d(!1), z = d(!1), Le = (t) => {
      r.value = t, E.value = !0;
    }, Ae = async () => {
      try {
        await v.delete({ ids: r.value.id }), x.value = x.value.filter(
          (t) => t.id !== r.value.id
        ), E.value = !1, r.value = {};
      } catch (t) {
        c("error", { detail: t.message });
      }
    }, Ne = () => {
      O.value && O.value.length && (z.value = !0);
    }, Me = async () => {
      const t = O.value.map((i) => i.id).join(",");
      try {
        await v.delete({ ids: t }), x.value = x.value.filter(
          (i) => !O.value.includes(i)
        ), z.value = !1, O.value = null;
      } catch (i) {
        c("error", { detail: i.message });
      }
    }, O = d(), F = d(!1), Ee = (t) => {
      F.value = t.checked, F.value ? (F.value = !0, O.value = x.value) : (F.value = !1, O.value = []);
    }, ze = () => {
      F.value = O.value.length === ee.value;
    }, $e = () => {
      F.value = !1;
    }, oe = (t) => t.readonly ? "readonly " + t.type : t.type, Ke = (t) => {
      if (W.value[t.id] && W.value[t.id].class)
        return W.value[t.id].class;
    };
    return (t, i) => {
      const u = Ge("PVTables", !0);
      return n(), P("div", al, [
        f(o(We), { class: "p-mb-4" }, {
          start: b(() => [
            (n(!0), P(D, null, Y(o(L).filter((e) => e.head), (e) => (n(), m(o(C), {
              icon: e.icon,
              label: e.label,
              class: $(e.class),
              onClick: e.head_click
            }, null, 8, ["icon", "label", "class", "onClick"]))), 256))
          ]),
          end: b(() => [
            f(o(C), {
              icon: "pi pi-refresh",
              class: "p-button-rounded p-button-success",
              onClick: i[0] || (i[0] = (e) => ae())
            }),
            f(o(C), {
              type: "button",
              icon: "pi pi-filter-slash",
              onClick: i[1] || (i[1] = (e) => xe())
            })
          ]),
          _: 1
        }),
        f(o(qe), {
          value: x.value,
          lazy: "",
          paginator: "",
          first: ce.value,
          rows: 10,
          rowsPerPageOptions: [10, 60, 30, 10],
          paginatorTemplate: "RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
          currentPageReportTemplate: "{first} to {last} of {totalRecords}",
          ref_key: "dt",
          ref: X,
          dataKey: "id",
          totalRecords: ee.value,
          loading: H.value,
          onPage: i[3] || (i[3] = (e) => Ce(e)),
          onSort: i[4] || (i[4] = (e) => Se(e)),
          sortMode: "multiple",
          editMode: "cell",
          onCellEditComplete: M,
          selection: O.value,
          "onUpdate:selection": i[5] || (i[5] = (e) => O.value = e),
          selectAll: F.value,
          onSelectAllChange: Ee,
          onRowSelect: ze,
          onRowUnselect: $e,
          filters: V.value,
          "onUpdate:filters": i[6] || (i[6] = (e) => V.value = e),
          filterDisplay: "menu",
          globalFilterFields: fe.value,
          onFilter: i[7] || (i[7] = (e) => Ue(e)),
          expandedRows: A.value,
          "onUpdate:expandedRows": i[8] || (i[8] = (e) => A.value = e),
          showGridlines: "",
          scrollable: "",
          scrollHeight: "45rem",
          resizableColumns: "",
          columnResizeMode: "expand",
          size: "small",
          rowClass: Ke
        }, {
          expansion: b((e) => [
            _.value[e.data.id].action == "subtables" ? (n(), P("div", tl, [
              f(u, {
                table: _.value[e.data.id].table,
                actions: y.actions,
                filters: T.value[e.data.id],
                ref: (l) => {
                  l && (N.value[e.data.id] = l);
                }
              }, null, 8, ["table", "actions", "filters"])
            ])) : K("", !0),
            _.value[e.data.id].action == "subtabs" ? (n(), P("div", il, [
              f(o(Ze), {
                tabs: _.value[e.data.id].tabs,
                actions: y.actions,
                filters: T.value[e.data.id],
                ref: (l) => {
                  l && (N.value[e.data.id] = l);
                }
              }, null, 8, ["tabs", "actions", "filters"])
            ])) : K("", !0)
          ]),
          default: b(() => [
            f(o(I), {
              selectionMode: "multiple",
              headerStyle: "width: 3rem"
            }),
            (n(!0), P(D, null, Y(Q.value.filter((e) => e.modal_only != !0), (e) => (n(), P(D, {
              key: e.field
            }, [
              e.field == "id" ? (n(), m(o(I), {
                key: 0,
                field: "id",
                header: "id",
                sortable: ""
              }, {
                body: b(({ data: l, field: a }) => [
                  ne(B(l[a]), 1)
                ]),
                _: 1
              })) : e.type == "autocomplete" ? (n(), m(o(I), {
                key: 1,
                field: e.field,
                header: e.label,
                class: $(oe(e)),
                sortable: ""
              }, {
                body: b(({ data: l, field: a }) => {
                  var s;
                  return [
                    f(o(Ve), {
                      table: e.table,
                      id: l[a],
                      "onUpdate:id": (k) => l[a] = k,
                      options: (s = te.value[a]) == null ? void 0 : s.rows,
                      onSetValue: (k) => M({ data: l, field: a, newValue: l[a] }),
                      disabled: e.readonly
                    }, null, 8, ["table", "id", "onUpdate:id", "options", "onSetValue", "disabled"])
                  ];
                }),
                filter: b(({ filterModel: l }) => [
                  f(o(G), {
                    modelValue: l.value,
                    "onUpdate:modelValue": (a) => l.value = a,
                    type: "text",
                    class: "p-column-filter",
                    placeholder: J(e)
                  }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"])
                ]),
                _: 2
              }, 1032, ["field", "header", "class"])) : e.type == "select" ? (n(), m(o(I), {
                key: 2,
                field: e.field,
                header: e.label,
                class: $(oe(e)),
                sortable: ""
              }, {
                body: b(({ data: l, field: a }) => {
                  var s;
                  return [
                    f(o(ke), {
                      id: l[a],
                      "onUpdate:id": (k) => l[a] = k,
                      options: (s = le.value[a]) == null ? void 0 : s.rows,
                      onSetValue: (k) => M({ data: l, field: a, newValue: l[a] }),
                      disabled: e.readonly
                    }, null, 8, ["id", "onUpdate:id", "options", "onSetValue", "disabled"])
                  ];
                }),
                filter: b(({ filterModel: l }) => [
                  f(o(G), {
                    modelValue: l.value,
                    "onUpdate:modelValue": (a) => l.value = a,
                    type: "text",
                    class: "p-column-filter",
                    placeholder: J(e)
                  }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"])
                ]),
                _: 2
              }, 1032, ["field", "header", "class"])) : (n(), m(o(I), {
                key: 3,
                field: e.field,
                header: e.label,
                class: $(oe(e)),
                sortable: ""
              }, je({
                body: b(({ data: l, field: a }) => [
                  e.type == "decimal" ? (n(), P(D, { key: 0 }, [
                    ne(B(Fe(l[a])), 1)
                  ], 64)) : e.type == "boolean" ? (n(), m(o(he), {
                    key: 1,
                    modelValue: l[a],
                    "onUpdate:modelValue": (s) => l[a] = s,
                    onKeydown: i[2] || (i[2] = He(Qe(() => {
                    }, ["stop"]), ["tab"])),
                    onChange: (s) => M({ data: l, field: a, newValue: l[a] }),
                    disabled: e.readonly
                  }, null, 8, ["modelValue", "onUpdate:modelValue", "onChange", "disabled"])) : e.type === "date" ? (n(), m(o(we), {
                    key: 2,
                    "model-value": l[a],
                    "onUpdate:modelValue": (s) => M({ data: l, field: a, newValue: s }),
                    disabled: e.readonly
                  }, null, 8, ["model-value", "onUpdate:modelValue", "disabled"])) : (n(), P(D, { key: 3 }, [
                    ne(B(l[a]), 1)
                  ], 64))
                ]),
                filter: b(({ filterModel: l }) => [
                  f(o(G), {
                    modelValue: l.value,
                    "onUpdate:modelValue": (a) => l.value = a,
                    type: "text",
                    class: "p-column-filter",
                    placeholder: J(e)
                  }, null, 8, ["modelValue", "onUpdate:modelValue", "placeholder"])
                ]),
                _: 2
              }, [
                !["boolean", "date"].includes(e.type) && !e.readonly ? {
                  name: "editor",
                  fn: b(({ data: l, field: a }) => [
                    e.type == "textarea" ? (n(), m(o(be), {
                      key: 0,
                      modelValue: l[a],
                      "onUpdate:modelValue": (s) => l[a] = s,
                      rows: "1"
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])) : e.type == "number" ? (n(), m(o(Z), {
                      key: 1,
                      modelValue: l[a],
                      "onUpdate:modelValue": (s) => l[a] = s
                    }, null, 8, ["modelValue", "onUpdate:modelValue"])) : e.type == "decimal" ? (n(), m(o(Z), {
                      key: 2,
                      modelValue: l[a],
                      "onUpdate:modelValue": (s) => l[a] = s,
                      minFractionDigits: e.FractionDigits,
                      maxFractionDigits: e.FractionDigits
                    }, null, 8, ["modelValue", "onUpdate:modelValue", "minFractionDigits", "maxFractionDigits"])) : (n(), m(o(G), {
                      key: 3,
                      modelValue: l[a],
                      "onUpdate:modelValue": (s) => l[a] = s
                    }, null, 8, ["modelValue", "onUpdate:modelValue"]))
                  ]),
                  key: "0"
                } : void 0
              ]), 1032, ["field", "header", "class"]))
            ], 64))), 128)),
            q.value ? (n(), m(o(I), {
              key: 0,
              exportable: !1,
              style: { "white-space": "nowrap" }
            }, {
              body: b((e) => [
                (n(!0), P(D, null, Y(o(L).filter((l) => l.row), (l) => (n(), m(o(C), {
                  icon: l.icon,
                  class: $(l.class),
                  onClick: (a) => l.click(e.data, Q.value)
                }, null, 8, ["icon", "class", "onClick"]))), 256))
              ]),
              _: 1
            })) : K("", !0)
          ]),
          _: 1
        }, 8, ["value", "first", "totalRecords", "loading", "selection", "selectAll", "filters", "globalFilterFields", "expandedRows"]),
        f(o(re), {
          visible: S.value,
          "onUpdate:visible": i[9] || (i[9] = (e) => S.value = e),
          style: { width: "450px" },
          header: "Редактировать",
          modal: !0,
          class: "p-fluid"
        }, {
          footer: b(() => [
            f(o(C), {
              label: "Отмена",
              icon: "pi pi-times",
              class: "p-button-text",
              onClick: _e
            }),
            f(o(C), {
              label: "Сохранить",
              icon: "pi pi-check",
              class: "p-button-text",
              onClick: Te
            })
          ]),
          default: b(() => [
            (n(!0), P(D, null, Y(Q.value.filter((e) => e.table_only != !0), (e) => {
              var l, a;
              return n(), P("div", ol, [
                j("label", {
                  for: e.field
                }, B(e.label), 9, sl),
                e.field == "id" ? (n(), P("p", {
                  key: 0,
                  id: e.field
                }, B(r.value[e.field]), 9, nl)) : e.type == "textarea" ? (n(), m(o(be), {
                  key: 1,
                  id: e.field,
                  modelValue: r.value[e.field],
                  "onUpdate:modelValue": (s) => r.value[e.field] = s,
                  modelModifiers: { trim: !0 },
                  disabled: e.readonly
                }, null, 8, ["id", "modelValue", "onUpdate:modelValue", "disabled"])) : e.type == "number" ? (n(), m(o(Z), {
                  key: 2,
                  id: e.field,
                  modelValue: r.value[e.field],
                  "onUpdate:modelValue": (s) => r.value[e.field] = s,
                  disabled: e.readonly
                }, null, 8, ["id", "modelValue", "onUpdate:modelValue", "disabled"])) : e.type == "autocomplete" ? (n(), m(o(Ve), {
                  key: 3,
                  id: r.value[e.field],
                  "onUpdate:id": (s) => r.value[e.field] = s,
                  table: e.table,
                  options: (l = te.value[e.field]) == null ? void 0 : l.rows,
                  disabled: e.readonly
                }, null, 8, ["id", "onUpdate:id", "table", "options", "disabled"])) : e.type == "select" ? (n(), m(o(ke), {
                  key: 4,
                  id: r.value[e.field],
                  "onUpdate:id": (s) => r.value[e.field] = s,
                  options: (a = le.value[e.field]) == null ? void 0 : a.rows,
                  disabled: e.readonly
                }, null, 8, ["id", "onUpdate:id", "options", "disabled"])) : e.type == "decimal" ? (n(), m(o(Z), {
                  key: 5,
                  id: e.field,
                  modelValue: r.value[e.field],
                  "onUpdate:modelValue": (s) => r.value[e.field] = s,
                  minFractionDigits: e.FractionDigits,
                  maxFractionDigits: e.FractionDigits,
                  disabled: e.readonly
                }, null, 8, ["id", "modelValue", "onUpdate:modelValue", "minFractionDigits", "maxFractionDigits", "disabled"])) : e.type == "boolean" ? (n(), m(o(he), {
                  key: 6,
                  id: e.field,
                  modelValue: r.value[e.field],
                  "onUpdate:modelValue": (s) => r.value[e.field] = s,
                  disabled: e.readonly
                }, null, 8, ["id", "modelValue", "onUpdate:modelValue", "disabled"])) : e.type === "date" ? (n(), m(o(we), {
                  key: 7,
                  modelValue: r.value[e.field],
                  "onUpdate:modelValue": (s) => r.value[e.field] = s,
                  disabled: e.readonly
                }, null, 8, ["modelValue", "onUpdate:modelValue", "disabled"])) : (n(), m(o(G), {
                  key: 8,
                  id: e.field,
                  modelValue: r.value[e.field],
                  "onUpdate:modelValue": (s) => r.value[e.field] = s,
                  modelModifiers: { trim: !0 },
                  disabled: e.readonly
                }, null, 8, ["id", "modelValue", "onUpdate:modelValue", "disabled"]))
              ]);
            }), 256))
          ]),
          _: 1
        }, 8, ["visible"]),
        f(o(re), {
          visible: E.value,
          "onUpdate:visible": i[11] || (i[11] = (e) => E.value = e),
          style: { width: "450px" },
          header: "Confirm",
          modal: !0
        }, {
          footer: b(() => [
            f(o(C), {
              label: "Нет",
              icon: "pi pi-times",
              class: "p-button-text",
              onClick: i[10] || (i[10] = (e) => E.value = !1)
            }),
            f(o(C), {
              label: "Да",
              icon: "pi pi-check",
              class: "p-button-text",
              onClick: Ae
            })
          ]),
          default: b(() => [
            j("div", rl, [
              dl,
              r.value ? (n(), P("span", ul, "Вы хотите удалить эту запись?")) : K("", !0)
            ])
          ]),
          _: 1
        }, 8, ["visible"]),
        f(o(re), {
          visible: z.value,
          "onUpdate:visible": i[13] || (i[13] = (e) => z.value = e),
          style: { width: "450px" },
          header: "Confirm",
          modal: !0
        }, {
          footer: b(() => [
            f(o(C), {
              label: "Нет",
              icon: "pi pi-times",
              class: "p-button-text",
              onClick: i[12] || (i[12] = (e) => z.value = !1)
            }),
            f(o(C), {
              label: "Да",
              icon: "pi pi-check",
              class: "p-button-text",
              onClick: Me
            })
          ]),
          default: b(() => [
            j("div", pl, [
              cl,
              r.value ? (n(), P("span", fl, "Вы хотите удалить отмеченные записи?")) : K("", !0)
            ])
          ]),
          _: 1
        }, 8, ["visible"])
      ]);
    };
  }
}, Tl = {
  install: (y, g) => {
    y.component(ge.name, ge);
  }
};
export {
  ge as PVTables,
  Tl as default
};
