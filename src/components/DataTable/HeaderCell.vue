<template>
    <th
        ref="headerCell"
        :style="containerStyle"
        :class="containerClass"
        :tabindex="columnProp('sortable') ? '0' : null"
        role="columnheader"
        :colspan="columnProp('colspan')"
        :rowspan="columnProp('rowspan')"
        :aria-sort="ariaSort"
        @click="onClick"
        @keydown="onKeyDown"
        @mousedown="onMouseDown"
        @touchstart="onTouchStart"
        @touchend="onTouchEnd"
        @touchcancel="onTouchCancel"
        @dragstart="onDragStart"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
        v-bind="{ ...getColumnPT('root'), ...getColumnPT('headerCell') }"
        :data-p-sortable-column="columnProp('sortable')"
        :data-p-resizable-column="resizableColumns"
        :data-p-sorted="isColumnSorted()"
        :data-p-filter-column="filterColumn"
        :data-p-frozen-column="columnProp('frozen')"
        :data-p-reorderable-column="reorderableColumns"
    >
        <span v-if="resizableColumns && !columnProp('frozen')" :class="cx('columnResizer')" @mousedown="onResizeStart" v-bind="getColumnPT('columnResizer')"></span>
        
        <!-- Поповер для изменения ширины колонки на мобильных устройствах -->
        <Popover ref="columnWidthPopover" :dismissable="true">
            <div class="column-width-control" style="padding: 1rem; min-width: 280px;">
                <h4 style="margin: 0 0 1rem 0; font-size: 0.95rem;">{{ columnProp('header') }}</h4>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">
                        Ширина колонки: <strong>{{ currentColumnWidth }}px</strong>
                    </label>
                    <div style="touch-action: none;">
                        <Slider 
                            v-model="currentColumnWidth" 
                            :min="50" 
                            :max="500" 
                            :step="10"
                        />
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <Button 
                        label="Сбросить" 
                        icon="pi pi-refresh" 
                        size="small" 
                        severity="secondary"
                        @click="resetColumnWidth"
                    />
                    <Button 
                        label="Применить" 
                        icon="pi pi-check" 
                        size="small" 
                        severity="success"
                        @click="applyColumnWidth"
                    />
                </div>
            </div>
        </Popover>
        <div :class="cx('columnHeaderContent')" v-bind="getColumnPT('columnHeaderContent')">
            <component v-if="column.children && column.children.header" :is="column.children.header" :column="column" />
            <span v-if="columnProp('header')" :class="cx('columnTitle')" v-bind="getColumnPT('columnTitle')">{{ columnProp('header') }}</span>
            <span v-if="columnProp('sortable')" v-bind="getColumnPT('sort')">
                <component :is="(column.children && column.children.sorticon) || sortableColumnIcon" :sorted="sortState.sorted" :sortOrder="sortState.sortOrder" :class="cx('sortIcon')" v-bind="getColumnPT('sorticon')" />
            </span>
            <Badge v-if="isMultiSorted()" :class="cx('pcSortBadge')" :pt="getColumnPT('pcSortBadge')" :value="getBadgeValue()" size="small" />
            <DTHeaderCheckbox
                v-if="columnProp('selectionMode') === 'multiple' && filterDisplay !== 'row'"
                :checked="allRowsSelected"
                @change="onHeaderCheckboxChange"
                :disabled="empty"
                :headerCheckboxIconTemplate="column.children && column.children.headercheckboxicon"
                :column="column"
                :unstyled="unstyled"
                :pt="pt"
            />
            <DTColumnFilter
                v-if="filterDisplay === 'menu' && column.children && column.children.filter"
                :field="columnProp('filterField') || columnProp('field')"
                :type="columnProp('dataType')"
                display="menu"
                :showMenu="columnProp('showFilterMenu')"
                :filterElement="column.children && column.children.filter"
                :filterHeaderTemplate="column.children && column.children.filterheader"
                :filterFooterTemplate="column.children && column.children.filterfooter"
                :filterClearTemplate="column.children && column.children.filterclear"
                :filterApplyTemplate="column.children && column.children.filterapply"
                :filterIconTemplate="column.children && column.children.filtericon"
                :filterAddIconTemplate="column.children && column.children.filteraddicon"
                :filterRemoveIconTemplate="column.children && column.children.filterremoveicon"
                :filterClearIconTemplate="column.children && column.children.filterclearicon"
                :filters="filters"
                :filtersStore="filtersStore"
                :filterInputProps="filterInputProps"
                :filterButtonProps="filterButtonProps"
                :filterList="filterList"
                @filter-change="$emit('filter-change', $event)"
                @filter-apply="$emit('filter-apply')"
                :filterMenuStyle="columnProp('filterMenuStyle')"
                :filterMenuClass="columnProp('filterMenuClass')"
                :showOperator="columnProp('showFilterOperator')"
                :showClearButton="columnProp('showClearButton')"
                :showApplyButton="columnProp('showApplyButton')"
                :showMatchModes="columnProp('showFilterMatchModes')"
                :showAddButton="columnProp('showAddButton')"
                :matchModeOptions="columnProp('filterMatchModeOptions')"
                :maxConstraints="columnProp('maxConstraints')"
                @operator-change="$emit('operator-change', $event)"
                @matchmode-change="$emit('matchmode-change', $event)"
                @constraint-add="$emit('constraint-add', $event)"
                @constraint-remove="$emit('constraint-remove', $event)"
                @apply-click="$emit('apply-click', $event)"
                :column="column"
                :unstyled="unstyled"
                :pt="pt"
            />
        </div>
    </th>
</template>

<script>
import { getAttribute, getIndex, getNextElementSibling, getOuterWidth, getPreviousElementSibling } from '@primeuix/utils/dom';
import BaseComponent from '@primevue/core/basecomponent';
import { getVNodeProp } from '@primevue/core/utils';
import SortAltIcon from '@primevue/icons/sortalt';
import SortAmountDownIcon from '@primevue/icons/sortamountdown';
import SortAmountUpAltIcon from '@primevue/icons/sortamountupalt';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import Slider from 'primevue/slider';
import { mergeProps } from 'vue';
import ColumnFilter from './ColumnFilter.vue';
import HeaderCheckbox from './HeaderCheckbox.vue';

export default {
    name: 'HeaderCell',
    hostName: 'DataTable',
    extends: BaseComponent,
    emits: [
        'column-click',
        'column-mousedown',
        'column-dragstart',
        'column-dragover',
        'column-dragleave',
        'column-drop',
        'column-resizestart',
        'column-resize-end',
        'checkbox-change',
        'filter-change',
        'filter-apply',
        'operator-change',
        'matchmode-change',
        'constraint-add',
        'constraint-remove',
        'filter-clear',
        'apply-click'
    ],
    props: {
        column: {
            type: Object,
            default: null
        },
        index: {
            type: Number,
            default: null
        },
        resizableColumns: {
            type: Boolean,
            default: false
        },
        groupRowsBy: {
            type: [Array, String, Function],
            default: null
        },
        sortMode: {
            type: String,
            default: 'single'
        },
        groupRowSortField: {
            type: [String, Function],
            default: null
        },
        sortField: {
            type: [String, Function],
            default: null
        },
        sortOrder: {
            type: Number,
            default: null
        },
        multiSortMeta: {
            type: Array,
            default: null
        },
        allRowsSelected: {
            type: Boolean,
            default: false
        },
        empty: {
            type: Boolean,
            default: false
        },
        filterDisplay: {
            type: String,
            default: null
        },
        filters: {
            type: Object,
            default: null
        },
        filtersStore: {
            type: Object,
            default: null
        },
        filterColumn: {
            type: Boolean,
            default: false
        },
        reorderableColumns: {
            type: Boolean,
            default: false
        },
        filterInputProps: {
            type: null,
            default: null
        },
        filterButtonProps: {
            type: null,
            default: null
        },
        filterList: {
            type: Object,
            default: null
        }
    },
    data() {
        return {
            styleObject: {},
            longPressTimer: null,
            longPressDelay: 500, // 500ms для долгого нажатия
            longPressTriggered: false, // Флаг что долгое нажатие сработало
            currentColumnWidth: 150,
            originalColumnWidth: 150
        };
    },
    mounted() {
        if (this.columnProp('frozen')) {
            this.updateStickyPosition();
        }
        // Получаем текущую ширину колонки
        this.$nextTick(() => {
            this.updateCurrentColumnWidth();
        });
    },
    updated() {
        if (this.columnProp('frozen')) {
            this.updateStickyPosition();
        }
    },
    methods: {
        columnProp(prop) {
            return getVNodeProp(this.column, prop);
        },
        getColumnPT(key) {
            const columnMetaData = {
                props: this.column.props,
                parent: {
                    instance: this,
                    props: this.$props,
                    state: this.$data
                },
                context: {
                    index: this.index,
                    sortable: this.columnProp('sortable') === '' || this.columnProp('sortable'),
                    sorted: this.isColumnSorted(),
                    resizable: this.resizableColumns,
                    size: this.$parentInstance?.$parentInstance?.size,
                    showGridlines: this.$parentInstance?.$parentInstance?.showGridlines || false
                }
            };

            return mergeProps(this.ptm(`column.${key}`, { column: columnMetaData }), this.ptm(`column.${key}`, columnMetaData), this.ptmo(this.getColumnProp(), key, columnMetaData));
        },
        getColumnProp() {
            return this.column.props && this.column.props.pt ? this.column.props.pt : undefined; //@todo:
        },
        onClick(event) {
            this.$emit('column-click', { originalEvent: event, column: this.column });
        },
        onKeyDown(event) {
            if ((event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Space') && event.currentTarget.nodeName === 'TH' && getAttribute(event.currentTarget, 'data-p-sortable-column')) {
                this.$emit('column-click', { originalEvent: event, column: this.column });
                event.preventDefault();
            }
        },
        onMouseDown(event) {
            this.$emit('column-mousedown', { originalEvent: event, column: this.column });
        },
        onDragStart(event) {
            this.$emit('column-dragstart', { originalEvent: event, column: this.column });
        },
        onDragOver(event) {
            this.$emit('column-dragover', { originalEvent: event, column: this.column });
        },
        onDragLeave(event) {
            this.$emit('column-dragleave', { originalEvent: event, column: this.column });
        },
        onDrop(event) {
            this.$emit('column-drop', { originalEvent: event, column: this.column });
        },
        onResizeStart(event) {
            this.$emit('column-resizestart', event);
        },
        getMultiSortMetaIndex() {
            return this.multiSortMeta.findIndex((meta) => meta.field === this.columnProp('field') || meta.field === this.columnProp('sortField'));
        },
        getBadgeValue() {
            let index = this.getMultiSortMetaIndex();

            return this.groupRowsBy && this.groupRowsBy === this.groupRowSortField && index > -1 ? index : index + 1;
        },
        isMultiSorted() {
            return this.sortMode === 'multiple' && this.columnProp('sortable') && this.getMultiSortMetaIndex() > -1;
        },
        isColumnSorted() {
            return this.sortMode === 'single' ? this.sortField && (this.sortField === this.columnProp('field') || this.sortField === this.columnProp('sortField')) : this.isMultiSorted();
        },
        updateStickyPosition() {
            if (this.columnProp('frozen')) {
                let align = this.columnProp('alignFrozen');

                if (align === 'right') {
                    let right = 0;
                    let next = getNextElementSibling(this.$el, '[data-p-frozen-column="true"]');

                    if (next) {
                        right = getOuterWidth(next) + parseFloat(next.style.right || 0);
                    }

                    this.styleObject.right = right + 'px';
                } else {
                    let left = 0;
                    let prev = getPreviousElementSibling(this.$el, '[data-p-frozen-column="true"]');

                    if (prev) {
                        left = getOuterWidth(prev) + parseFloat(prev.style.left || 0);
                    }

                    this.styleObject.left = left + 'px';
                }

                let filterRow = this.$el.parentElement.nextElementSibling;

                if (filterRow) {
                    let index = getIndex(this.$el);

                    if (filterRow.children[index]) {
                        filterRow.children[index].style.left = this.styleObject.left;
                        filterRow.children[index].style.right = this.styleObject.right;
                    }
                }
            }
        },
        onHeaderCheckboxChange(event) {
            this.$emit('checkbox-change', event);
        },
        updateCurrentColumnWidth() {
            if (this.$refs.headerCell) {
                const width = this.$refs.headerCell.offsetWidth;
                this.currentColumnWidth = width;
                this.originalColumnWidth = width;
            }
        },
        onTouchStart(event) {
            // Запускаем таймер для долгого нажатия только если resizableColumns включен
            if (!this.resizableColumns || this.columnProp('frozen')) {
                return;
            }
            
            // Сбрасываем флаг
            this.longPressTriggered = false;
            
            // Сохраняем элемент для использования в showColumnWidthPopover
            const targetElement = event.currentTarget;
            
            this.longPressTimer = setTimeout(() => {
                this.longPressTriggered = true;
                this.showColumnWidthPopover(targetElement);
            }, this.longPressDelay);
        },
        onTouchEnd(event) {
            // Отменяем таймер если палец убрали до истечения времени
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            
            // Если долгое нажатие сработало, предотвращаем контекстное меню
            if (this.longPressTriggered) {
                event.preventDefault();
                this.longPressTriggered = false;
            }
        },
        onTouchCancel(event) {
            // Отменяем таймер если касание было отменено
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            this.longPressTriggered = false;
        },
        showColumnWidthPopover(targetElement) {
            // Обновляем текущую ширину перед показом
            this.updateCurrentColumnWidth();
            
            // Показываем поповер, передавая элемент заголовка как target
            if (this.$refs.columnWidthPopover && targetElement) {
                // Используем $nextTick чтобы убедиться что DOM обновлен
                this.$nextTick(() => {
                    // Создаем фейковый event объект и передаем targetElement как второй параметр
                    const fakeEvent = { currentTarget: targetElement };
                    this.$refs.columnWidthPopover.toggle(fakeEvent, targetElement);
                });
            }
        },
        applyColumnWidth() {
            // Вычисляем дельту изменения
            const delta = this.currentColumnWidth - this.originalColumnWidth;
            
            // Эмитим событие column-resize-end с той же структурой, что и при обычном resize
            this.$emit('column-resize-end', {
                element: this.$refs.headerCell,
                delta: delta
            });
            
            // Обновляем оригинальную ширину
            this.originalColumnWidth = this.currentColumnWidth;
            
            // Закрываем поповер
            if (this.$refs.columnWidthPopover) {
                this.$refs.columnWidthPopover.hide();
            }
        },
        resetColumnWidth() {
            // Возвращаем оригинальную ширину
            this.currentColumnWidth = this.originalColumnWidth;
        }
    },
    computed: {
        containerClass() {
            return [this.cx('headerCell'), this.filterColumn ? this.columnProp('filterHeaderClass') : this.columnProp('headerClass'), this.columnProp('class')];
        },
        containerStyle() {
            let headerStyle = this.filterColumn ? this.columnProp('filterHeaderStyle') : this.columnProp('headerStyle');
            let columnStyle = this.columnProp('style');

            return this.columnProp('frozen') ? [columnStyle, headerStyle, this.styleObject] : [columnStyle, headerStyle];
        },
        sortState() {
            let sorted = false;
            let sortOrder = null;

            if (this.sortMode === 'single') {
                sorted = this.sortField && (this.sortField === this.columnProp('field') || this.sortField === this.columnProp('sortField'));
                sortOrder = sorted ? this.sortOrder : 0;
            } else if (this.sortMode === 'multiple') {
                let metaIndex = this.getMultiSortMetaIndex();

                if (metaIndex > -1) {
                    sorted = true;
                    sortOrder = this.multiSortMeta[metaIndex].order;
                }
            }

            return {
                sorted,
                sortOrder
            };
        },
        sortableColumnIcon() {
            const { sorted, sortOrder } = this.sortState;

            if (!sorted) return SortAltIcon;
            else if (sorted && sortOrder > 0) return SortAmountUpAltIcon;
            else if (sorted && sortOrder < 0) return SortAmountDownIcon;

            return null;
        },
        ariaSort() {
            if (this.columnProp('sortable')) {
                const { sorted, sortOrder } = this.sortState;

                if (sorted && sortOrder < 0) return 'descending';
                else if (sorted && sortOrder > 0) return 'ascending';
                else return 'none';
            } else {
                return null;
            }
        }
    },
    components: {
        Badge,
        Button,
        Popover,
        Slider,
        DTHeaderCheckbox: HeaderCheckbox,
        DTColumnFilter: ColumnFilter,
        SortAltIcon: SortAltIcon,
        SortAmountUpAltIcon: SortAmountUpAltIcon,
        SortAmountDownIcon: SortAmountDownIcon
    }
};
</script>
