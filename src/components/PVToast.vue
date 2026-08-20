<template>
  <Toast v-if="isOwner" v-bind="$attrs" />
</template>

<script setup>
/**
 * Один тостер на страницу.
 *
 * PrimeVue-шный <Toast/> подписывается на общую шину ToastEventBus, поэтому
 * КАЖДАЯ смонтированная копия рисует КАЖДОЕ сообщение. На странице расчёта
 * копий четыре (App.vue приложения плюс PVTables, PVTabs, PVTable изнутри
 * библиотеки) — пользователь видел четыре одинаковых уведомления.
 *
 * Убирать <Toast/> из компонентов библиотеки нельзя: тогда приложение,
 * которое забыло смонтировать свой, останется вообще без уведомлений.
 * Поэтому монтируют по-прежнему все, а рисует только владелец —
 * см. useToastOwner().
 */
import Toast from 'primevue/toast'
import { useToastOwner } from './useToastOwner.js'

defineOptions({ inheritAttrs: false })

const isOwner = useToastOwner()
</script>
