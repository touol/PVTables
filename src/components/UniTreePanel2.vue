<template>
    <div
        class="utp2"
        :class="{ 'utp2--narrow': narrow, 'utp2--touch': touch, 'utp2--open': narrow && leftOpen, 'utp2--collapsed': !narrow && leftCollapsed }"
        :style="{ '--utp2-left': (leftCollapsed ? 0 : leftWidth) + 'px', height: fitHeight || undefined }"
        ref="rootRef"
        >

        <!-- ── Левая колонка: дерево ────────────────────────────────────────
             На широком экране — обычная колонка грида, всегда видна.
             На узком — выезжающая панель поверх контента; компонент дерева
             при этом остаётся в DOM, поэтому открытие/закрытие ничего не
             перезагружает (в отличие от Drawer, который размонтирует контент). -->
        <aside class="utp2__left">
            <div class="utp2__left-head" v-if="treeTabKeys.length > 1 || narrow">
                <div class="utp2__tabs" v-if="treeTabKeys.length > 1">
                    <button
                        v-for="key in treeTabKeys"
                        :key="key"
                        type="button"
                        class="utp2__tab"
                        :class="{ 'utp2__tab--active': key === activeTreeTab }"
                        @click="activeTreeTab = key"
                        >{{ treetabs[key].title }}</button>
                </div>
                <span v-else class="utp2__left-title">{{ treetabs[treeTabKeys[0]] ? treetabs[treeTabKeys[0]].title : '' }}</span>
                <Button
                    v-if="narrow"
                    icon="pi pi-times"
                    text
                    severity="secondary"
                    rounded
                    aria-label="Скрыть дерево"
                    @click="leftOpen = false"
                    />
            </div>

            <div class="utp2__left-body">
                <template v-for="key in treeTabKeys" :key="key">
                    <div class="utp2__tabpane" v-show="key === activeTreeTab">
                        <UniTree2
                            v-if="treetabs[key].type === 'tree'"
                            :table="treetabs[key].table"
                            :dragable="treetabs[key].dragable !== false"
                            :touch="touch"
                            @select-treenode="selectTreenode"
                            :ref="el => { if (el) treeRefs[key] = el }"
                            />
                        <FileTree
                            v-else-if="treetabs[key].type === 'filetree'"
                            :mediaSources="treetabs[key].mediaSources || mediaSources"
                            @select-file="selectFile"
                            :ref="el => { if (el) treeRefs[key] = el }"
                            />
                    </div>
                </template>
            </div>

            <!-- Язычок на кромке панели: едет вместе с ней, поэтому виден и
                 когда дерево скрыто (панель уехала — язычок остался у края). -->
            <button
                type="button"
                class="utp2__handle"
                :aria-expanded="narrow ? leftOpen : !leftCollapsed"
                :title="handleTitle"
                :aria-label="handleTitle"
                @click="toggleLeft"
                ><i class="pi" :class="handleIcon"></i></button>
        </aside>

        <!-- ── Ресайзер ─────────────────────────────────────────────────────
             Своя полоса вместо PrimeVue Splitter: на pointer-событиях, так что
             работает и мышью, и пальцем, и с клавиатуры. Ширина запоминается. -->
        <div
            class="utp2__resizer"
            role="separator"
            aria-orientation="vertical"
            :aria-valuenow="leftWidth"
            tabindex="0"
            title="Потяните, чтобы изменить ширину. Двойной клик — сброс"
            @pointerdown="startResize"
            @dblclick="resetWidth"
            @keydown.left.prevent="nudgeWidth(-24)"
            @keydown.right.prevent="nudgeWidth(24)"
            ><span class="utp2__resizer-grip"></span></div>

        <!-- ── Подложка под выехавшей панелью ──────────────────────────── -->
        <div class="utp2__backdrop" @click="leftOpen = false"></div>

        <!-- ── Правая колонка: содержимое узла ─────────────────────────── -->
        <section class="utp2__right">
            <header class="utp2__head">
                <h2 class="utp2__title" :title="title">{{ title || 'Выберите узел' }}</h2>
            </header>
            <div class="utp2__content">
                <PVTabs
                    v-if="hasPanel"
                    :tabs="paneltabs"
                    :actions="{}"
                    :filters="filters"
                    :current_id="current_id"
                    :class_key="class_key"
                    scrollHeight="100%"
                    @update-treenode-title="updateTreeNodeTitle"
                    ref="panelRef"
                    />
                <div v-else class="utp2__placeholder">
                    <i class="pi pi-sitemap"></i>
                    <span>{{ narrow ? 'Откройте дерево и выберите узел' : 'Выберите узел в дереве слева' }}</span>
                </div>
            </div>
        </section>
    </div>
    <Toast/>
</template>

<script setup>
    /**
     * UniTreePanel2 — раскладка «дерево + карточка узла» без Splitter.
     *
     * Чем отличается от UniTreePanel:
     *  1. Нет PrimeVue Splitter. Вместо него CSS Grid с одной переменной
     *     --utp2-left и собственный ресайзер на pointer-событиях (Splitter
     *     слушает только мышь, поэтому на тачскрине не тянулся).
     *  2. Нет расчёта высот в пикселях из JS. Раньше их считали втроём —
     *     здесь и в PVTabs (autoUpdateHeights), и ещё раз в TanTable, —
     *     отсюда «то попадает в окно, то обрезается». Теперь высоту задаёт
     *     одна flex/grid-цепочка с min-height:0, а таблицам уходит 100%.
     *  3. Узкий экран: дерево уезжает в выезжающую панель, контент занимает
     *     всю ширину, тап по иконке показывает и скрывает дерево.
     *  4. Скроллов ровно два: тело дерева и тело правой панели.
     *
     * ⚠️ Высоту панель берёт от родителя (height: 100%). Если родитель высоты
     * не задаёт, включается запасное min-height: 60dvh.
     */
    import Toast from './PVToast.vue'  // синглтон: один тостер на страницу
    import Button from 'primevue/button';
    import { ref, computed, onMounted, onUnmounted } from 'vue';
    import PVTabs from './PVTabs.vue'
    import UniTree2 from './UniTree2.vue'
    import FileTree from './FileTree.vue'

    const props = defineProps({
        treetabs: {
            type: Object,
            required: true,
        },
        mediaSources: {
            type: Array,
            default: () => [],
        },
        // Ниже этой ширины дерево уходит в выезжающую панель.
        // 900 — чтобы планшет в альбоме остался с двумя колонками,
        // а телефон и планшет в портрете получили полноэкранный контент.
        narrowBreakpoint: {
            type: Number,
            default: 900,
        },
        defaultWidth: {
            type: Number,
            default: 320,
        },
        // Ключ для запоминания ширины: у разных деревьев она разная.
        storageKey: {
            type: String,
            default: '',
        },
        // Дотянуть панель ровно до низа экрана. Нужно, потому что страница
        // над панелью (шапка сайта, вкладки) высоту не резервирует, и
        // height:100dvh у контейнера приложения вылезает за экран — отсюда
        // лишний внешний скролл. Замеряется ровно одна величина: отступ
        // сверху. Высоты внутренностей по-прежнему раздаёт CSS.
        fitViewport: {
            type: Boolean,
            default: true,
        },
    });

    const treeRefs = ref({})
    const panelRef = ref()
    const rootRef = ref(null)

    const treeTabKeys = computed(() => Object.keys(props.treetabs || {}))
    const activeTreeTab = ref('')

    const paneltabs = ref({})
    const current_id = ref('')
    const current_node_id = ref(0)
    const current_tree_tab = ref('')
    const class_key = ref('')
    const title = ref('')
    const filters = ref({});
    const hasPanel = computed(() => Object.keys(paneltabs.value || {}).length > 0)

    // ─── Ширина левой колонки ────────────────────────────────────────────────
    const LS_KEY = computed(() => 'pvtables-unitree2-width-' + (props.storageKey || treeTabKeys.value.join('-')))
    const MIN_WIDTH = 180
    const MAX_WIDTH = 720
    const leftWidth = ref(props.defaultWidth)

    const clampWidth = (v) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(v)))

    const saveWidth = () => {
        try { localStorage.setItem(LS_KEY.value, String(leftWidth.value)) } catch {}
    }

    let resizePointerId = null
    const startResize = (event) => {
        if (narrow.value) return
        resizePointerId = event.pointerId
        event.currentTarget.setPointerCapture(resizePointerId)
        document.body.classList.add('utp2-resizing')
        window.addEventListener('pointermove', onResizeMove)
        window.addEventListener('pointerup', stopResize)
        window.addEventListener('pointercancel', stopResize)
    }
    const onResizeMove = (event) => {
        if (!rootRef.value) return
        const rect = rootRef.value.getBoundingClientRect()
        leftWidth.value = clampWidth(event.clientX - rect.left)
    }
    const stopResize = () => {
        window.removeEventListener('pointermove', onResizeMove)
        window.removeEventListener('pointerup', stopResize)
        window.removeEventListener('pointercancel', stopResize)
        document.body.classList.remove('utp2-resizing')
        resizePointerId = null
        saveWidth()
    }
    const resetWidth = () => { leftWidth.value = props.defaultWidth; saveWidth() }
    const nudgeWidth = (delta) => { leftWidth.value = clampWidth(leftWidth.value + delta); saveWidth() }

    // ─── Высота до низа экрана ───────────────────────────────────────────────
    const fitHeight = ref('')
    let fitObserver = null

    /** Отступы предков ниже панели: их тоже надо оставить, иначе страница вылезет. */
    const bottomSlack = () => {
        let slack = 0
        let el = rootRef.value ? rootRef.value.parentElement : null
        while (el && el !== document.documentElement) {
            const cs = getComputedStyle(el)
            slack += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.marginBottom) || 0)
            el = el.parentElement
        }
        return Math.round(slack)
    }

    const applyFit = () => {
        if (!props.fitViewport || !rootRef.value) return
        const rect = rootRef.value.getBoundingClientRect()
        // Панель может быть в неактивной вкладке — тогда мерить нечего.
        if (!rect.height && !rect.width) return
        const top = Math.max(0, Math.round(rect.top + (window.scrollY || 0)))
        const next = `calc(100dvh - ${top + bottomSlack()}px)`
        if (next !== fitHeight.value) fitHeight.value = next
    }

    // ─── Узкий экран и тач ───────────────────────────────────────────────────
    const narrow = ref(false)
    const touch = ref(false)
    const leftOpen = ref(false)
    // Широкий экран: дерево можно свернуть совсем, чтобы отдать всю ширину карточке.
    const leftCollapsed = ref(false)

    const toggleLeft = () => {
        if (narrow.value) {
            leftOpen.value = !leftOpen.value
        } else {
            leftCollapsed.value = !leftCollapsed.value
            try { localStorage.setItem(LS_KEY.value + '-collapsed', leftCollapsed.value ? '1' : '0') } catch {}
        }
    }
    const handleOpen = computed(() => narrow.value ? leftOpen.value : !leftCollapsed.value)
    const handleIcon = computed(() => handleOpen.value ? 'pi-angle-left' : 'pi-angle-right')
    const handleTitle = computed(() => handleOpen.value ? 'Скрыть дерево' : 'Показать дерево')

    let narrowMq = null
    let touchMq = null
    const onNarrowChange = (e) => {
        narrow.value = e.matches
        if (!e.matches) leftOpen.value = false
    }
    const onTouchChange = (e) => { touch.value = e.matches }

    onMounted(() => {
        activeTreeTab.value = treeTabKeys.value[0] || ''

        try {
            const saved = parseInt(localStorage.getItem(LS_KEY.value), 10)
            if (saved) leftWidth.value = clampWidth(saved)
            leftCollapsed.value = localStorage.getItem(LS_KEY.value + '-collapsed') === '1'
        } catch {}

        narrowMq = window.matchMedia(`(max-width: ${props.narrowBreakpoint - 1}px)`)
        // Ширину и «пальцевость» определяем порознь: планшет в альбоме — это
        // две колонки, но элементы всё равно должны быть под палец.
        touchMq = window.matchMedia('(pointer: coarse)')
        narrow.value = narrowMq.matches
        touch.value = touchMq.matches
        narrowMq.addEventListener('change', onNarrowChange)
        touchMq.addEventListener('change', onTouchChange)

        applyFit()
        window.addEventListener('resize', applyFit)
        if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
            // Ловит и первый показ (панель во вкладке, которую ещё не открывали),
            // и любые сдвиги шапки над панелью.
            fitObserver = new ResizeObserver(() => applyFit())
            fitObserver.observe(rootRef.value)
        }
    });

    onUnmounted(() => {
        if (narrowMq) narrowMq.removeEventListener('change', onNarrowChange)
        if (touchMq) touchMq.removeEventListener('change', onTouchChange)
        window.removeEventListener('resize', applyFit)
        if (fitObserver) fitObserver.disconnect()
        stopResize()
    });

    // ─── События дерева ──────────────────────────────────────────────────────
    const selectTreenode = (event) => {
        paneltabs.value = event.tabs || {}
        current_id.value = event.node.data.target_id ? event.node.data.target_id : event.node.data.id
        // id самого узла дерева нужен отдельно от target_id: точечное
        // обновление после сохранения формы адресуется именно узлу.
        current_node_id.value = event.node.data.id
        current_tree_tab.value = activeTreeTab.value
        class_key.value = event.node.data.class
        title.value = ''
        if(event.label) title.value = event.label + ': '
        title.value += event.node.title
        filters.value = event.subfilters
        // На узком экране выбор узла сразу показывает карточку.
        if (narrow.value) leftOpen.value = false
    }

    /**
     * Форма справа сохранена. Раньше это гнало полную перезагрузку дерева
     * (причём дважды — PVFormPanel эмитит событие два раза подряд).
     * Здесь обновляется один узел: один лёгкий запрос на одну строку.
     */
    const updateTreeNodeTitle = () => {
        const treeKey = current_tree_tab.value || activeTreeTab.value
        const tree = treeRefs.value[treeKey]
        if (tree && typeof tree.patchNode === 'function') {
            tree.patchNode(current_node_id.value)
        }
    }

    const selectFile = (event) => {
        paneltabs.value = {
            content: {
                type: 'filecontent',
                title: 'Содержимое',
                file: event.file,
                content: event.content,
                mime: event.mime,
                mediaSource: event.mediaSource
            }
        }
        title.value = event.file.path
        current_id.value = 0
        current_node_id.value = 0
        filters.value = {}
        if (narrow.value) leftOpen.value = false
    }

    defineExpose({ treeRefs, panelRef })
</script>

<style>
    /* ── Каркас ─────────────────────────────────────────────────────────────
       Одна сетка, одна переменная ширины. Третья колонка обязательно с
       min-width:0 — без этого широкая таблица распирает грид и внизу
       страницы появляется горизонтальный скролл. */
    .utp2 {
        position: relative;
        display: grid;
        grid-template-columns: var(--utp2-left, 320px) 10px minmax(0, 1fr);
        height: 100%;
        min-height: 60dvh;   /* запасной вариант, если родитель высоты не задал */
        width: 100%;
        overflow: hidden;
    }

    /* ── Левая колонка ──────────────────────────────────────────────────── */
    .utp2__left {
        grid-column: 1;
        position: relative;   /* якорь для язычка на кромке */
        display: flex;
        flex-direction: column;
        min-height: 0;
        min-width: 0;
        border-right: 1px solid var(--p-content-border-color, #e5e7eb);
        background: var(--p-content-background, #fff);
    }
    .utp2__left-head {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: .5rem;
        padding: .25rem .25rem .25rem .5rem;
        border-bottom: 1px solid var(--p-content-border-color, #e5e7eb);
    }
    .utp2__left-title {
        font-weight: 600;
        font-size: .9rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .utp2__tabs {
        display: flex;
        gap: .25rem;
        flex: 1;
        min-width: 0;
        overflow-x: auto;
    }
    .utp2__tab {
        flex-shrink: 0;
        padding: .3rem .6rem;
        border: 0;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        font-size: .85rem;
        color: var(--p-text-muted-color, #6b7280);
    }
    .utp2__tab--active {
        background: var(--p-highlight-background, rgba(100,100,255,.14));
        color: var(--p-text-color, #111827);
        font-weight: 600;
    }
    .utp2__left-body {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        padding: .35rem;
    }
    .utp2__tabpane {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    /* ── Ресайзер ───────────────────────────────────────────────────────── */
    .utp2__resizer {
        grid-column: 2;
        position: relative;
        cursor: col-resize;
        display: flex;
        align-items: center;
        justify-content: center;
        touch-action: none;   /* иначе жест уходит в скролл страницы */
        background: transparent;
    }
    .utp2__resizer:hover .utp2__resizer-grip,
    .utp2__resizer:focus-visible .utp2__resizer-grip {
        background: var(--p-primary-color, #3b82f6);
    }
    .utp2__resizer-grip {
        width: 3px;
        height: 42px;
        border-radius: 3px;
        background: var(--p-content-border-color, #d1d5db);
    }
    /* Пока тянут — курсор не должен «срываться» на выделение текста. */
    body.utp2-resizing {
        cursor: col-resize;
        user-select: none;
    }

    /* ── Правая колонка ─────────────────────────────────────────────────── */
    .utp2__right {
        grid-column: 3;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
    }
    .utp2__head {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: .25rem;
        padding: .35rem .5rem;
    }
    .utp2__title {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 600;
        line-height: 1.3;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .utp2__content {
        flex: 1;
        min-height: 0;
        min-width: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .utp2__placeholder {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: .5rem;
        color: var(--p-text-muted-color, #9ca3af);
    }
    .utp2__placeholder i {
        font-size: 2rem;
    }

    /* Высоты внутри правой панели задаёт эта цепочка, а не расчёт в пикселях.
       min-height:0 обязателен на каждом звене, иначе flex не даёт сжиматься. */
    .utp2__content > .p-tabs {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }
    .utp2__content .p-tablist {
        flex-shrink: 0;
    }
    .utp2__content .p-tabpanels {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: .5rem;
    }
    .utp2__content .p-tabpanel {
        min-height: 0;
    }
    .utp2 .p-tablist-tab-list {
        display: inherit !important;
    }

    /* ── Язычок на кромке панели ────────────────────────────────────────
       Сидит внутри левой панели и выступает наружу, поэтому едет вместе
       с ней: панель уехала за край — язычок остался виден у кромки. */
    .utp2__handle {
        position: absolute;
        top: 50%;
        right: -22px;
        transform: translateY(-50%);
        z-index: 32;
        width: 22px;
        height: 56px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: var(--p-content-background, #fff);
        color: var(--p-text-color, #334155);
        border: 1px solid var(--p-content-border-color, #cbd5e1);
        border-left: 0;
        border-radius: 0 8px 8px 0;
        box-shadow: 2px 0 6px rgba(0,0,0,.12);
    }
    .utp2__handle:hover {
        background: var(--p-primary-color, #3b82f6);
        border-color: var(--p-primary-color, #3b82f6);
        color: #fff;
    }
    .utp2__handle .pi {
        font-size: .95rem;
        font-weight: 700;
    }
    .utp2--touch .utp2__handle {
        width: 28px;
        height: 72px;
        right: -28px;
    }

    /* Свёрнутое дерево на широком экране: колонка нулевой ширины,
       наружу торчит только язычок. overflow:hidden здесь ставить нельзя —
       нулевая по ширине панель обрежет собственный язычок, и развернуть
       дерево станет нечем. Прячем содержимое, а не панель. */
    .utp2--collapsed .utp2__left {
        border-right: 0;
    }
    .utp2--collapsed .utp2__left-head,
    .utp2--collapsed .utp2__left-body {
        display: none;
    }
    .utp2--collapsed .utp2__resizer {
        pointer-events: none;
        visibility: hidden;
    }

    .utp2__backdrop {
        display: none;
    }

    /* ── Узкий экран: дерево поверх контента ────────────────────────────── */
    .utp2--narrow {
        grid-template-columns: minmax(0, 1fr);
    }
    .utp2--narrow .utp2__resizer {
        display: none;
    }
    .utp2--narrow .utp2__right {
        grid-column: 1;
    }
    .utp2--narrow .utp2__left {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        z-index: 30;
        width: min(86vw, 380px);
        transform: translateX(-100%);
        transition: transform .2s ease;
        box-shadow: 0 0 18px rgba(0,0,0,.18);
        will-change: transform;
    }
    .utp2--narrow.utp2--open .utp2__left {
        transform: translateX(0);
    }
    /* Язычок перекрывает содержимое карточки — сдвигаем её на его ширину. */
    .utp2--collapsed .utp2__right,
    .utp2--narrow .utp2__right {
        padding-left: 24px;
    }

    .utp2--narrow.utp2--open .utp2__backdrop {
        display: block;
        position: absolute;
        inset: 0;
        z-index: 20;
        background: rgba(0,0,0,.35);
    }
    /* Панель выезжает поверх — анимацию убираем тем, кто её просил отключить. */
    @media (prefers-reduced-motion: reduce) {
        .utp2--narrow .utp2__left { transition: none; }
    }

    /* ── Тач ────────────────────────────────────────────────────────────── */
    .utp2--touch .utp2__resizer {
        width: 16px;
    }
    .utp2--touch .utp2__title {
        font-size: 1rem;
    }
</style>
