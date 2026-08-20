import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/**
 * Реестр смонтированных тостеров — ОДИН на бандл pvtables.
 * Обязан жить в модуле: код внутри <script setup> выполняется на каждый
 * экземпляр компонента, и реестр там оказался бы у каждого свой.
 */
const registry = ref([])
let seq = 0

/**
 * Право рисовать тосты. Владелец — первый зарегистрировавшийся;
 * когда он размонтируется, роль переходит следующему (реестр реактивный),
 * поэтому уведомления не пропадают.
 *
 * @returns {import('vue').ComputedRef<boolean>}
 */
export function useToastOwner() {
  const id = ++seq
  const isOwner = computed(() => registry.value[0] === id)

  onMounted(() => { registry.value = [...registry.value, id] })
  onBeforeUnmount(() => { registry.value = registry.value.filter(x => x !== id) })

  return isOwner
}
