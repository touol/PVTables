<template>
    <div class="ut2" :class="{ 'ut2--touch': touch }">
        <div class="ut2__toolbar">
            <InputGroup @keydown.tab.stop>
                <InputText
                    v-model="searchTitle"
                    @input="onUserInput"
                    @keydown.enter="onUserInputEndEnter"
                    placeholder="Поиск..."
                    class="ut2__search"
                    />
                <Button
                    icon="pi pi-refresh"
                    class="p-button-text"
                    :loading="refreshing"
                    aria-label="Обновить"
                    @click="refreshData()"
                    />
                <ToggleButton
                    v-model="showInactive"
                    onIcon="pi pi-eye"
                    offIcon="pi pi-eye-slash"
                    class="p-button-sm"
                    @change="rebuild()"
                    />
                <UniTree2NodeMenu
                    :node="{data:{class:'root'}}"
                    :actions="actions"
                    @select-treenode-action="selectTreeNodeAction($event)"
                    />
            </InputGroup>
        </div>

        <div class="ut2__body" ref="bodyRef">
            <div v-if="loading" class="ut2__stub">Загрузка…</div>
            <div v-else-if="!treeNodes.length" class="ut2__stub">
                {{ searchTitle ? 'Ничего не найдено' : 'Пусто' }}
            </div>
            <sl-vue-tree-next
                v-show="!loading && treeNodes.length"
                v-model="treeNodes"
                ref="slVueTree"
                @toggle="toggleNode"
                @nodeclick="onNodeclick"
                @drop="onDrop"
                @beforedrop="onBeforeDrop"
                >
                <template #toggle="{ node }">
                    <i v-if="!node.isLeaf" class="ut2__chevron pi" :class="node.isExpanded ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
                </template>
                <template #title="{ node }">
                    <span v-if="gtsAPIUniTreeClass[node.data.class] && gtsAPIUniTreeClass[node.data.class].svg"
                          class="ut2__icon"
                          v-html="gtsAPIUniTreeClass[node.data.class].svg">
                    </span>
                    <span class="ut2__label" v-html="highlightText(node, searchTitle)"></span>
                </template>
                <template #sidebar="{ node }">
                    <UniTree2NodeMenu
                        :node="node"
                        :actions="actions"
                        @select-treenode-action="selectTreeNodeAction($event)"
                        />
                </template>
            </sl-vue-tree-next>
        </div>
    </div>

    <Dialog
      v-model:visible="ItemDialog"
      :header="ItemDialogLabel"
      modal
      :style="touch ? { width: '100vw', height: '100vh', maxHeight: '100vh', margin: 0 } : { width: '32rem' }"
      >
      <PVForm
        v-model="Item"
        :columns="columns"
        :mywatch="mywatch"
      />
      <template #footer>
        <Button
          label="Отмена"
          icon="pi pi-times"
          class="p-button-text"
          @click="ItemDialog = false"
          />
        <Button
          label="Сохранить"
          icon="pi pi-check"
          class="p-button-text"
          @click="saveItem"
          />
      </template>
    </Dialog>

    <Dialog
        v-model:visible="deleteDialog"
        header="Подтвердите"
        modal
        >
        <div class="confirmation-content">
            <i class="pi pi-exclamation-triangle p-mr-3" style="font-size: 2rem" />
            <span>Вы действительно хотите удалить запись?</span>
        </div>
        <template #footer>
            <Button
            label="Нет"
            icon="pi pi-times"
            class="p-button-text"
            @click="deleteDialog = false"
            />
            <Button
            label="Да"
            icon="pi pi-check"
            class="p-button-text"
            @click="deleteItem"
            />
        </template>
    </Dialog>
    <Toast/>
</template>

<script setup>
    /**
     * UniTree2 — дерево без полной перезагрузки на каждое действие.
     *
     * Чем отличается от UniTree:
     *  1. Состояние раскрытия живёт по id узла (Set), а не по пути ([0,1,3]).
     *     Пути съезжают при любой вставке/удалении/перемещении — из-за этого
     *     после перезагрузки раскрывалась не та ветка.
     *  2. Нет watch(nodes, deep) → filterTree → setTimeout(expandTree).
     *     Именно эта цепочка давала кадр со свёрнутым деревом — то самое
     *     «моргание». Здесь раскрытие проставляется сразу при сборке модели.
     *  3. Действия не зовут options() (весь список узлов + actions + fields):
     *       удаление        — 0 запросов, узел со своим поддеревом убирается локально;
     *       создание        — 1 лёгкий запрос (одна строка) вместо всего дерева;
     *       правка в форме  — 1 лёгкий запрос;
     *       перемещение/копия — тихий read() без options, с сохранением
     *                           раскрытия, выделения и позиции скролла.
     *  4. Скролл и выделение переживают любое обновление, включая ручное.
     */
    import Toast from './PVToast.vue'  // синглтон: один тостер на страницу
    import Dialog from "primevue/dialog";
    import Button from "primevue/button";
    import InputGroup from "primevue/inputgroup";
    import InputText from "primevue/inputtext";
    import ToggleButton from "primevue/togglebutton";

    import UniTree2NodeMenu from './UniTree2NodeMenu.vue'
    import { SlVueTreeNext } from 'sl-vue-tree-next'
    import 'sl-vue-tree-next/sl-vue-tree-next-minimal.css';
    import { ref, onMounted, nextTick } from 'vue';
    import apiCtor from './api'
    import { useNotifications } from "./useNotifications";
    import PVForm from "./PVForm.vue";

    const props = defineProps({
        table: {
            type: String,
            required: true,
        },
        dragable:{
            type:Boolean,
            default: true
        },
        dragcopy:{
            type:Boolean,
            default: true
        },
        // Тач-режим: крупнее строки и кнопки, перетаскивание узлов выключено.
        // Библиотека sl-vue-tree-next работает только на mouse-событиях
        // (ни одного touch*/pointer* в исходнике) — на тачскрине drag-n-drop
        // не начнётся в принципе, а живые mousedown-хендлеры съедают тап.
        touch:{
            type:Boolean,
            default: false
        }
    });

    const api = apiCtor(props.table)
    const { notify } = useNotifications();

    const loading = ref(true);
    const refreshing = ref(false);

    // sourceTree — полное дерево от сервера, единственный источник правды.
    // treeNodes — то, что отдано библиотеке (после поиска и фильтра активности).
    const sourceTree = ref([]);
    const treeNodes = ref([]);

    const expandedIds = ref(new Set());
    const selectedId = ref(0);

    const slVueTree = ref();
    const bodyRef = ref();
    const actions = ref({});
    const nodeclick = ref({});
    const gtsAPIUniTreeClass = ref({});
    const showInactive = ref(false);
    const searchTitle = ref('')
    const dragable1 = ref(true);
    const dragcopy1 = ref(true);

    let fields = {}
    let params = new URLSearchParams(document.location.search);

    const emit = defineEmits(['select-treenode']);

    // ─── Обход и поиск по дереву ──────────────────────────────────────────────

    const walk = (list, cb, parent = null) => {
        for (const node of list || []) {
            if (cb(node, parent) === false) return false
            if (node.children && walk(node.children, cb, node) === false) return false
        }
        return true
    }

    const findEntry = (list, id, parent = null) => {
        for (let i = 0; i < (list || []).length; i++) {
            const node = list[i]
            if (node.data && node.data.id == id) return { node, list, index: i, parent }
            if (node.children) {
                const found = findEntry(node.children, id, node)
                if (found) return found
            }
        }
        return null
    }

    // ─── Сборка видимой модели ────────────────────────────────────────────────

    const matchesSearch = (node, search) => !search || String(node.title || '').toLowerCase().includes(search)

    /**
     * Строит модель для библиотеки: применяет фильтры, проставляет раскрытие
     * из expandedIds и выделение из selectedId. Узлы — новые объекты, чтобы
     * библиотека не мутировала sourceTree через v-model.
     */
    const buildVisible = (list, search) => {
        const out = []
        for (const node of list || []) {
            if (!showInactive.value && node.data && node.data.active == 0) continue

            const children = node.children ? buildVisible(node.children, search) : []
            const selfMatch = matchesSearch(node, search)
            if (search && !selfMatch && !children.length) continue

            const id = node.data ? node.data.id : 0
            const copy = {
                title: node.title,
                data: node.data,
                isSelected: id && id == selectedId.value,
            }
            if (node.isLeaf) {
                copy.isLeaf = true
            } else {
                // При активном поиске ветки с совпадениями раскрываем принудительно,
                // иначе найденное остаётся спрятанным внутри свёрнутого родителя.
                copy.isExpanded = search ? (children.length > 0) : expandedIds.value.has(id)
            }
            if (children.length) copy.children = children
            out.push(copy)
        }
        return out
    }

    /** Пересобирает видимое дерево, не теряя позицию скролла. */
    const rebuild = async () => {
        const scrollTop = bodyRef.value ? bodyRef.value.scrollTop : 0
        const search = searchTitle.value ? searchTitle.value.toLowerCase() : ''
        treeNodes.value = buildVisible(sourceTree.value, search)
        await nextTick()
        if (bodyRef.value) bodyRef.value.scrollTop = scrollTop
    }

    // ─── Загрузка ─────────────────────────────────────────────────────────────

    /** Полная загрузка: дерево + actions + fields + иконки. Только при монтировании. */
    const loadTree = async () => {
        try {
            const response = await api.options()
            sourceTree.value = response.data.out.slTree || [];
            actions.value = response.data.actions;
            nodeclick.value = response.data.nodeclick

            dragable1.value = props.dragable
            if(response.data.dragable){
                dragable1.value = response.data.dragable == 1
            }
            dragcopy1.value = props.dragcopy
            if(response.data.dragcopy){
                dragcopy1.value = response.data.dragcopy == 1
            }

            fields = response.data.fields;
            gtsAPIUniTreeClass.value = response.data.gtsAPIUniTreeClass || {};

            // Узел из адресной строки: раскрываем путь к нему и выделяем.
            if (selectedId.value > 0) expandPathTo(selectedId.value)

            await rebuild()
            loading.value = false;

            if (selectedId.value > 0) {
                const entry = findEntry(sourceTree.value, selectedId.value)
                if (entry) onNodeclick(entry.node)
            }
        } catch (error) {
            loading.value = false;
            notify('error', { detail: error.message }, true);
        }
    }

    /**
     * Тихое обновление данных: read() без options(). Раскрытие, выделение и
     * скролл сохраняются, поэтому дерево не «прыгает».
     */
    const refreshData = async () => {
        refreshing.value = true
        try {
            // Читается через options, а не read: у деревьев в gtsAPI нет
            // разрешённого экшена read (tree.class.php пускает без него только
            // options/autocomplete/nodedrop), поэтому GET отвечает
            // «Not api action!». Ключевое здесь не объём запроса, а то, что
            // раскрытие, выделение и скролл переживают обновление.
            const response = await api.options()
            sourceTree.value = response.data.out.slTree || []
            if (response.data.actions) actions.value = response.data.actions
            await rebuild()
        } catch (error) {
            notify('error', { detail: error.message }, true);
        } finally {
            refreshing.value = false
        }
    }

    /**
     * Возвращает нормализованный узел одной строки. На боевом дереве это
     * ~8 КБ против ~256 КБ у полной выдачи.
     */
    const fetchNode = async (id) => {
        const response = await api.options(null, {
            limit: 1,
            setTotal: 0,
            filters: { id: { value: id, matchMode: 'equals' } },
        })
        const out = response.data.out || {}
        const tree = out.slTree || []
        if (!tree.length) return null
        const node = tree[0]
        // При одной строке сервер принудительно ставит parent_id = 0
        // (getslTree, ветка count($rows) == 1). Настоящего родителя берём из
        // цепочки parents_ids вида «#1#2#1172#» — последнее звено.
        const chain = String(node.data.parents_ids || '').split('#').filter(Boolean)
        if (chain.length) {
            node.data.parent_id = Number(chain[chain.length - 1])
        } else {
            const raw = (out.rows || [])[0]
            if (raw && raw.parent_id !== undefined) node.data.parent_id = Number(raw.parent_id)
        }
        return node
    }

    // ─── Точечные операции над sourceTree ─────────────────────────────────────

    /** Порядок детей, как его строит сервер: папки выше листьев, затем menuindex, затем id. */
    const sortChildren = (list) => {
        list.sort((a, b) => {
            const aLeaf = a.isLeaf ? 1 : 0
            const bLeaf = b.isLeaf ? 1 : 0
            if (aLeaf !== bLeaf) return aLeaf - bLeaf
            const am = Number(a.data.menuindex || 0)
            const bm = Number(b.data.menuindex || 0)
            if (am !== bm) return am - bm
            return Number(a.data.id || 0) - Number(b.data.id || 0)
        })
    }

    const insertNodeLocal = (node) => {
        const parentId = Number(node.data.parent_id || 0)
        let list = sourceTree.value
        if (parentId) {
            const parent = findEntry(sourceTree.value, parentId)
            if (parent) {
                // Лист, у которого появился ребёнок, становится папкой.
                if (parent.node.isLeaf) {
                    delete parent.node.isLeaf
                    parent.node.isExpanded = false
                }
                if (!parent.node.children) parent.node.children = []
                list = parent.node.children
                expandedIds.value.add(parentId)
            }
        }
        list.push(node)
        sortChildren(list)
    }

    const removeNodeLocal = (id) => {
        const entry = findEntry(sourceTree.value, id)
        if (!entry) return false
        // Дети уходят вместе с узлом — на сервере они удаляются каскадом
        // (TableTreeCrudTrait::delete рекурсивно по parentIdField).
        walk([entry.node], (n) => { if (n.data) expandedIds.value.delete(n.data.id) })
        entry.list.splice(entry.index, 1)
        if (entry.parent && !entry.parent.children.length) {
            delete entry.parent.children
            entry.parent.isLeaf = true
            delete entry.parent.isExpanded
        }
        return true
    }

    /** Раскрывает всех предков узла, чтобы он оказался виден. */
    const expandPathTo = (id) => {
        const chain = []
        const search = (list, trail) => {
            for (const node of list || []) {
                const nextTrail = node.data ? [...trail, node.data.id] : trail
                if (node.data && node.data.id == id) { chain.push(...nextTrail); return true }
                if (node.children && search(node.children, nextTrail)) return true
            }
            return false
        }
        search(sourceTree.value, [])
        // Сам узел раскрывать не нужно — только путь к нему.
        chain.slice(0, -1).forEach(pid => expandedIds.value.add(pid))
    }

    // ─── События дерева ───────────────────────────────────────────────────────

    const toggleNode = (toggledNode) => {
        // В событие приходит состояние ДО переключения (см. onToggleHandler
        // в sl-vue-tree-next: patch применяется, затем эмитится старый снимок).
        const id = toggledNode.data ? toggledNode.data.id : 0
        if (!id) return
        if (toggledNode.isExpanded) {
            expandedIds.value.delete(id)
        } else {
            expandedIds.value.add(id)
        }
    }

    const onBeforeDrop = (nodes, position, cancelFn) => {
        if (!dragable1.value || props.touch) cancelFn();
    }

    const onDrop = async (nodes, position, event) => {
        let class_key = ''
        let nodes1 = []
        for(let k in nodes){
            if(class_key == '') class_key = nodes[k].data.class
            if(class_key != nodes[k].data.class){
                notify('error', { detail: 'Cannot move nodes of different classes' }, true);
                await refreshData()
                return
            }
            nodes1.push({id:nodes[k].data.id,parent_id:nodes[k].data.parent_id,menuindex:nodes[k].data.menuindex})
        }
        const position1 = {
            placement:position.placement,
            node:{id:position.node.data.id,parent_id:position.node.data.parent_id,menuindex:position.node.data.menuindex}
        }

        const isCopy = event && event.ctrlKey && dragcopy1.value;

        try {
            await api.nodedrop({nodes1, position1, copy: isCopy})
            // Библиотека уже переставила узлы визуально, но menuindex и
            // parents_ids пересчитывает сервер (в т.ч. сдвигает соседей).
            // Брать их с сервера надёжнее, чем угадывать: иначе следующий
            // drop уедет не туда. Обновление тихое — без схлопывания.
            await refreshData()
        } catch (error) {
            notify('error', { detail: error.message }, true);
            await refreshData()
        }
    }

    const onNodeclick = async (node) => {
        let target_id = node.data.target_id ? node.data.target_id : node.data.id
        if(!nodeclick.value.classes) return

        let tabs
        let label
        const cfgKey = nodeclick.value.classes[node.data.class] ? node.data.class : 'default'
        const cfg = nodeclick.value.classes[cfgKey]
        if(cfg){
            if(cfg.label) label = cfg.label
            if(cfg.tabs){
                tabs = cfg.tabs
            }else if(cfg.table){
                const apiTable = apiCtor(cfg.table)
                try {
                    const data = await apiTable.get(target_id)
                    for(let key in cfg){
                        if(key == 'table') continue
                        if(cfg[key].if){
                            let check = true
                            for(let k in cfg[key].if){
                                if(data[k] != cfg[key].if[k]) check = false
                            }
                            if(check) tabs = cfg[key].tabs
                        }
                    }
                } catch (error) {
                    notify('error', { detail: error.message }, true);
                }
            }
        }

        if(node.data.id > 0){
            selectedId.value = node.data.id
            params.set(props.table + "/id", selectedId.value)
            window.history.replaceState({}, '', `${location.pathname}?${params}`);
            markSelected(node.data.id)
        }

        let subfilters = {}
        const makeFilters = (where) => {
            let tmpfilters = {};
            for (let field in where) {
                let value = where[field]
                if(value == 'current_id') value = target_id
                if(value == 'tree_id') value = node.data.id
                tmpfilters[field] = {
                    operator: 'and',
                    constraints: [{ value: value, matchMode: 'equals' }],
                };
            }
            return tmpfilters
        }
        for(let key in tabs){
            if (tabs[key].hasOwnProperty("where")) {
                subfilters[key] = makeFilters(tabs[key].where);
            }
            if (tabs[key].hasOwnProperty("tables")) {
                for(let table_key in tabs[key].tables){
                    subfilters[table_key] = makeFilters(tabs[key].tables[table_key].where);
                }
            }
        }

        if (tabs) {
            const processTabsRecursively = (obj) => {
                for (let key in obj) {
                    if (typeof obj[key] === 'string' && obj[key].includes('insert_menu_id')) {
                        obj[key] = obj[key].replace(/insert_menu_id/g, target_id);
                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        processTabsRecursively(obj[key]);
                    }
                }
            };
            processTabsRecursively(tabs);
        }
        emit('select-treenode',{tabs,label,node,subfilters})
    }

    /** Переставляет подсветку выделения без пересборки всего дерева. */
    const markSelected = (id) => {
        walk(treeNodes.value, (n) => { n.isSelected = !!(n.data && n.data.id == id) })
    }

    // ─── Диалоги create / delete ──────────────────────────────────────────────

    const setCollomns = (fields) => {
        let cols = [];
        for (let field in fields) {
          fields[field].field = field;
          if (!fields[field].hasOwnProperty("label")) fields[field].label = field;
          if (!fields[field].hasOwnProperty("type")) fields[field].type = "text";
          if (fields[field].hasOwnProperty("readonly")){
            fields[field].readonly = fields[field].readonly === true || fields[field].readonly == 1
          }
          cols.push(fields[field]);
        }
        return cols
    }

    const Item = ref({})
    const columns = ref({})
    const ItemDialog = ref(false)
    const deleteDialog = ref(false)
    const ItemDialogLabel = ref('Создать')
    const mywatch = ref({ enabled: false, fields: [], table: '', action: '' });

    const selectTreeNodeAction = (event) => {
        if(actions.value[event.action] && actions.value[event.action].tables){
            const action = actions.value[event.action].tables[event.table]
            if(action.form == 'UniTree'){
                let fields0 = {
                    title:{ type: "text", label: action.title_label || "Заголовок" }
                }
                if(action.add_fields && Object.keys(action.add_fields).length > 0) {
                    fields0 = {...fields0, ...action.add_fields}
                }
                columns.value = setCollomns(fields0)
                Item.value = {
                    parent_id: event.node.data.id,
                    form: 'UniTree',
                    table: event.table,
                    action: event.action
                };
                if(event.action == 'copy'){
                    Item.value.parent_id = event.node.data.parent;
                    Item.value.ids = event.node.data.id;
                }
                ItemDialogLabel.value = action.label ? action.label : 'Создать'
                ItemDialog.value = true;
            }
        }else{
            switch(event.action){
                case 'delete':
                    Item.value = { ids: event.node.data.id };
                    deleteDialog.value = true;
                break
            }
        }
    }

    const saveItem = async () => {
        const isCopy = Item.value.action == 'copy'
        const parentId = Item.value.parent_id
        try {
            if(Item.value.form != 'UniTree') return

            const response = isCopy
                ? await api.action('copy', Item.value)
                : await api.create(Item.value, {});

            if (!response) {
                notify('error', { detail: 'Получен пустой ответ от сервера' }, true);
                return;
            }
            if (!response.success) {
                notify('error', { detail: response.message }, true);
                return;
            }

            notify('success', { detail: isCopy ? 'Запись успешно скопирована' : 'Запись успешно создана' });

            const newId = response.data && response.data.object ? response.data.object.id : 0
            if (!isCopy && newId) {
                // Создана одна строка — забираем только её (1 лёгкий запрос),
                // остальное дерево остаётся на месте.
                const node = await fetchNode(newId)
                if (node) {
                    if (parentId) node.data.parent_id = Number(parentId)
                    insertNodeLocal(node)
                    await rebuild()
                } else {
                    await refreshData()
                }
            } else {
                // Копирование тянет за собой целое поддерево — тихий read.
                await refreshData()
            }
        } catch (error) {
            const errorMessage = error?.message || error?.toString() || 'Произошла ошибка при сохранении';
            notify('error', { detail: errorMessage });
            await refreshData()
        } finally {
            Item.value = {};
            ItemDialog.value = false;
        }
    };

    const deleteItem = async () => {
        const ids = String(Item.value.ids || '').split(',').filter(Boolean)
        try {
            const response = await api.delete(Item.value)
            if (!response.success) {
                notify('error', { detail: response.message }, true);
                await refreshData()
                return
            }
            // Сервер вернул удалённые ids, детей снёс каскадом — здесь узлы
            // убираются вместе с поддеревом, без единого запроса.
            let ok = ids.length > 0
            for (const id of ids) {
                if (!removeNodeLocal(id)) ok = false
                if (selectedId.value == id) selectedId.value = 0
            }
            if (ok) { await rebuild() } else { await refreshData() }
        } catch (error) {
            notify('error', { detail: error.message });
            await refreshData()
        } finally {
            Item.value = {};
            deleteDialog.value = false;
        }
    };

    // ─── Поиск ────────────────────────────────────────────────────────────────

    const highlightText = (node, searchText) => {
        let text = node.title
        if (searchText) {
            const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
            text = text.replace(regex, '<mark class="ut2__mark">$1</mark>')
        }
        if(node.data.active != 1){
            text = '<em>' + text + '</em>'
        }
        return text
    }

    const onUserInput = () => {
        if (searchTitle.value && searchTitle.value.trim().length >= 3) {
            rebuild()
        } else if (!searchTitle.value || searchTitle.value.trim() === '') {
            rebuild()
        }
    }

    const onUserInputEndEnter = () => { rebuild() }

    // ─── Внешний API компонента ───────────────────────────────────────────────

    /**
     * Точечное обновление одного узла — вызывается после сохранения формы
     * в правой панели. Один лёгкий запрос вместо полной перезагрузки дерева.
     */
    // PVFormPanel на одно сохранение эмитит update-treenode-title дважды
    // (второй раз с uniTreeTable = null), поэтому одинаковые запросы,
    // пришедшие подряд, схлопываем в один.
    const inFlight = new Map()

    const patchNode = async (id) => {
        if (!id) return
        if (inFlight.has(id)) return inFlight.get(id)
        const promise = patchNodeNow(id).finally(() => inFlight.delete(id))
        inFlight.set(id, promise)
        return promise
    }

    const patchNodeNow = async (id) => {
        const entry = findEntry(sourceTree.value, id)
        if (!entry) { await refreshData(); return }
        try {
            const node = await fetchNode(id)
            if (!node) { await refreshData(); return }
            entry.node.title = node.title
            Object.assign(entry.node.data, node.data, { parent_id: entry.node.data.parent_id })
            await rebuild()
        } catch (error) {
            notify('error', { detail: error.message }, true);
        }
    }

    /** Совместимость с интерфейсом UniTree: refresh(from_parent, table). */
    const refresh = (from_parent, table, id) => {
        if (id) return patchNode(id)
        return refreshData()
    };

    defineExpose({ refresh, refreshData, patchNode, loadTree });

    onMounted(async () => {
        if(params.get(props.table + "/id") > 0) selectedId.value = Number(params.get(props.table + "/id"))
        await loadTree()
    })
</script>

<style>
    /* ── Каркас ─────────────────────────────────────────────────────────── */
    .ut2 {
        height: 100%;
        width: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }
    .ut2__toolbar {
        flex-shrink: 0;
        padding-bottom: .35rem;
    }
    .ut2__body {
        flex: 1;
        min-height: 0;
        overflow: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
    }
    .ut2__stub {
        padding: .75rem .5rem;
        color: var(--p-text-muted-color, #6b7280);
    }

    /* ── Строка узла ────────────────────────────────────────────────────────
       В оригинале .sl-vue-tree-next-root стоял font-size: x-large — длинные
       ФИО переносились на вторую строку и наезжали на кнопки действий. */
    .ut2 .sl-vue-tree-next-root {
        font-size: .95rem;
    }
    .ut2 .sl-vue-tree-next-node-item {
        align-items: center;
        border-radius: 4px;
        padding: 1px 2px;
    }
    .ut2 .sl-vue-tree-next-node-item:hover {
        background-color: var(--p-content-hover-background, rgba(0,0,0,.04));
    }
    .ut2 .sl-vue-tree-next-selected > .sl-vue-tree-next-node-item {
        background-color: var(--p-highlight-background, rgba(100,100,255,.18));
    }
    .ut2 .sl-vue-tree-next-gap {
        width: 14px;
        flex-shrink: 0;
    }
    /* .sl-vue-tree-next-title держит toggle и слот заголовка; без min-width:0
       длинный текст распирает строку и появляется горизонтальный скролл. */
    .ut2 .sl-vue-tree-next-title {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: .35rem;
        overflow: hidden;
    }
    .ut2 .sl-vue-tree-next-sidebar {
        flex-shrink: 0;
        margin-left: auto;
        padding-left: .25rem;
    }
    .ut2__label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .ut2__mark {
        background-color: #fde68a;
        color: inherit;
        padding: 0 1px;
        border-radius: 2px;
    }
    .ut2__icon {
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
    }
    .ut2__icon svg {
        width: 18px;
        height: 18px;
    }

    /* Зона нажатия у раскрывашки: текстовые «+/−» пальцем не попадаются. */
    .ut2 .sl-vue-tree-next-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        flex-shrink: 0;
        cursor: pointer;
    }
    .ut2__chevron {
        font-size: .7rem;
        color: var(--p-text-muted-color, #6b7280);
    }

    /* Кнопка действий узла — на десктопе по наведению/выделению, чтобы не
       городить колонку кнопок поверх заголовков. */
    .ut2:not(.ut2--touch) .sl-vue-tree-next-sidebar .ut2-node-menu {
        visibility: hidden;
    }
    .ut2:not(.ut2--touch) .sl-vue-tree-next-node-item:hover .ut2-node-menu,
    .ut2:not(.ut2--touch) .sl-vue-tree-next-node-item:focus-within .ut2-node-menu,
    .ut2:not(.ut2--touch) .sl-vue-tree-next-selected .ut2-node-menu {
        visibility: visible;
    }

    /* ── Тач ────────────────────────────────────────────────────────────── */
    .ut2--touch .sl-vue-tree-next-root {
        font-size: 1rem;
    }
    .ut2--touch .sl-vue-tree-next-node-item {
        min-height: 2.6rem;
    }
    .ut2--touch .sl-vue-tree-next-toggle {
        width: 32px;
        height: 32px;
    }
    .ut2--touch .ut2__chevron {
        font-size: .85rem;
    }
    .ut2--touch .sl-vue-tree-next-gap {
        width: 18px;
    }
    .ut2 .p-togglebutton-label {
        display: none;
    }
</style>
