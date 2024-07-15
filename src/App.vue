
<template>
  <PVTables table="sraschet" 
    :actions="actions" 
    ref="childComponentRef"
  />
  <Toast/>
  <Dialog
    v-model:visible="createDocDialog"
    :style="{ width: '450px' }"
    header="Создать"
    :modal="true"
    class="p-fluid"
  >
    <div class="p-field">
      <label for="doc_type_id">Тип документа</label>
      <GTSAutocomplete
        v-model:id="DocLink.doc_type_id"
        table="DocType"
        @set-value="
          fValidateDocLink(1)
        "
      />
      <span v-if="!ValidateDocLink.doc_type_id" class="p-error">Это поле требуется.</span>
    </div>
    <template v-if="DocLink.doc_type_id==1">
      <div class="p-field">
        <label for="doc_id">Договор</label>
        <GTSAutocomplete
          v-model:id="DocLink.doc_id"
          table="OrgsContract"
          :parent="order"
          @set-value="
            fValidateDocLink(2)
          "
        />
        <span v-if="!ValidateDocLink.doc_id" class="p-error">Это поле требуется.</span>
      </div>
    </template>
    <template v-if="DocLink.doc_type_id==2">
      <TabView>
        <TabPanel key="createAccountIn1c" header="Создать счет в 1с">
          <createAccountIn1c :raschet_id="order.id" @acc-create-on="oncreateAccountIn1c($event)"/>
        </TabPanel>
        <TabPanel key="editAccount" header="Создать счет вручную">
          <editAccount v-model="account"/>
        </TabPanel>
      </TabView>
    </template>
    <template #footer>
      <Button
        label="Отмена"
        icon="pi pi-times"
        class="p-button-text"
        @click="hideDialog"
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
    v-model:visible="updateDocDialog"
    :style="{ width: '450px' }"
    header="Создать"
    :modal="true"
    class="p-fluid"
  >
    <div class="p-field">
      <label for="doc_type_id">Тип документа</label>
      <GTSAutocomplete
        v-model:id="DocLink.doc_type_id"
        table="DocType"
        @set-value="
          fValidateDocLink(1)
        "
      />
      <span v-if="!ValidateDocLink.doc_type_id" class="p-error">Это поле требуется.</span>
    </div>
    <template v-if="DocLink.doc_type_id==1">
      <div class="p-field">
        <label for="doc_id">Договор</label>
        <GTSAutocomplete
          v-model:id="DocLink.doc_id"
          table="OrgsContract"
          :parent="order"
          @set-value="
            fValidateDocLink(2)
          "
        />
        <span v-if="!ValidateDocLink.doc_id" class="p-error">Это поле требуется.</span>
      </div>
    </template>
    <template v-if="DocLink.doc_type_id==2">
      <editAccount v-model="account"/>
    </template>
    <template #footer>
      <Button
        label="Отмена"
        icon="pi pi-times"
        class="p-button-text"
        @click="hideDialog"
      />
      <Button
        label="Сохранить"
        icon="pi pi-check"
        class="p-button-text"
        @click="saveItem"
      />
    </template>
  </Dialog>
</template>

<script setup>

  import { PVTables } from 'pvtables/pvtables'
  import { ref } from 'vue';
  import Toast from 'primevue/toast';

  import Button from "primevue/button";
  import Dialog from "primevue/dialog";
  import TabView from 'primevue/tabview';
  import TabPanel from 'primevue/tabpanel';

  import GTSAutocomplete from "pvtables/gtsautocomplete";
  import apiCtor from 'pvtables/api'
  import { useNotifications } from "pvtables/notify";

  const childComponentRef = ref()
  const createDocDialog = ref(false)
  const updateDocDialog = ref(false)
  
  const api = apiCtor('DocOrderLink')
  // const submitted = ref(false)
  const api_sraschet = apiCtor('sraschet')
  const api_doc1cAccount = apiCtor('doc1cAccount')
  const { notify } = useNotifications();
  
  const DocLink = ref({})
  const ValidateDocLink = ref({
    doc_type_id:true,
    type_order_id:true,
    doc_id:true,
    order_id:true,
  })
  const account = ref({
    base_id:'1',
    period_id:'',
    nomer_1c:'',
    nomer_1c_str:'',
    date_1c:'',
    file:''
  })
  const order = ref({})
  const actions = ref({
    DocOrderLink:{
      create:{
        head:true,
        icon:"pi pi-plus",
        class:"p-button-rounded p-button-success",
        head_click: async (event,table,filters,selectedlineItems) => {
          
          // console.log('create',event,table,filters,selectedlineItems)
          const order_id = filters.order_id.constraints[0].value
          try {
            order.value = await api_sraschet.get(order_id)
          } catch (error) {
            notify('error', { detail: error.message });
            return
          }
          DocLink.value = {
            // doc_type_id:'',
            type_order_id:1,
            // doc_id:'',
            order_id:order_id,
          }
          // console.log('order.value',order.value)
          createDocDialog.value = true
          // childComponentRef.value.refresh('DocOrderLink');
          
        }
      },
      update:{
        row:true,
        icon:"pi pi-pencil",
        class:"p-button-rounded p-button-success",
        click: async (data, columns,table,filters) => {
          
          // console.log('update',data, columns,table,filters)
          // const order_id = filters.order_id.constraints[0].value
          // try {
          //   order.value = await api_sraschet.get(order_id)
          // } catch (error) {
          //   notify('error', { detail: error.message });
          //   return
          // }
          DocLink.value = data
          if(DocLink.value.doc_type_id == 2){
            try {
              account.value = await api_doc1cAccount.get(DocLink.value.doc_id)
            } catch (error) {
              notify('error', { detail: error.message });
              return
            }
          }
          // console.log('order.value',order.value)
          updateDocDialog.value = true
          // childComponentRef.value.refresh('DocOrderLink');
          
        }
      }
    },
    
  })
  const hideDialog = () => {
    createDocDialog.value = false;
    updateDocDialog.value = false
    // submitted.value = false;
  };

  import createAccountIn1c from "./components/createAccountIn1c.vue";

  const oncreateAccountIn1c = async (resp) => {
    // console.log('resp2',resp)
    try {
      DocLink.value.doc_id = resp.data.doc1cAccount.id
      await api.create(DocLink.value)
      createDocDialog.value = false;
      DocLink.value = {};
    } catch (error) {
      notify('error', { detail: error.message });
    }
    childComponentRef.value.refresh('DocOrderLink');
  };
  
  import editAccount from "./components/editAccount.vue";
  
  const fValidateDocLink = (step) => {
    if(!DocLink.value.doc_type_id){
      ValidateDocLink.value.doc_type_id = false
      return false
    }else{
      ValidateDocLink.value.doc_type_id = true
    }
    if(step == 1) return true
    switch(DocLink.value.doc_type_id){
      case '1':
        if(!DocLink.value.doc_id){
          ValidateDocLink.value.doc_id = false
          // return false
        }else{
          ValidateDocLink.value.doc_id = true
        }
      break
    }
    for(let field in ValidateDocLink.value){
      if(!ValidateDocLink.value[field]) return false
    }
    // console.log('ValidateDocLink2',ValidateDocLink)
    return true
  };
  const saveItem = async () => {
    if(!fValidateDocLink()) return
    switch(DocLink.value.doc_type_id){
      case '1':
        if (DocLink.value.id) {
          try {
            await api.update(DocLink.value)
            createDocDialog.value = false;
            updateDocDialog.value = false
            DocLink.value = {};
          } catch (error) {
            notify('error', { detail: error.message });
          }
        } else {
          try {
            await api.create(DocLink.value)
            createDocDialog.value = false;
            updateDocDialog.value = false
            DocLink.value = {};
          } catch (error) {
            notify('error', { detail: error.message });
          }
        }
      break
      case '2':
        console.log('account',account.value)
        
        if (account.value.id) {
          try {
            await api_doc1cAccount.update(account.value)
            createDocDialog.value = false;
            updateDocDialog.value = false
            account.value = {};
          } catch (error) {
            notify('error', { detail: error.message });
          }
        } else {
          try {
            const response = await api_doc1cAccount.create(account.value)
            // console.log('response',response)
            DocLink.value.doc_id = response.data.id
            try {
              await api.create(DocLink.value)
              createDocDialog.value = false;
              updateDocDialog.value = false
              account.value = {};
              DocLink.value = {};
            } catch (error) {
              notify('error', { detail: error.message });
            }
          } catch (error) {
            notify('error', { detail: error.message });
          }
        }
      break
    }
    childComponentRef.value.refresh('DocOrderLink');
  };
</script>
<style>
  .inline-button .p-button{
    width: auto;
  }
</style>
