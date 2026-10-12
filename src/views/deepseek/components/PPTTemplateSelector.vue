<template>
  <div class="template-selector">
    <div class="header">
      <div class="title">选择模板创建PPT</div>
    </div>
    
    <div class="category-nav">
      <div 
        v-for="category in categories" 
        :key="category"
        :class="['category-item', currentCategory === category ? 'active' : '']"
        @click="currentCategory = category"
      >
        {{ category === 'all' ? '全部' : category }}
      </div>
    </div>

    <div class="templates-container">
      <div class="templates-grid">
        <div 
          v-for="(template, index) in filteredTemplates" 
          :key="index"
          class="template-item"
          @click="selectTemplate(template)"
        >
          <img :src="template.viewImage" :alt="template.name" />
        </div>
      </div>
    </div>

    <div class="action-buttons">
      <el-button @click="$emit('close')">取消</el-button>
      <el-button 
        type="primary" 
        @click="handleConfirm"
        :disabled="!selectedTemplate"
      >
        确认使用
      </el-button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  name: 'PPTTemplateSelector',
  props: {
    outline: {
      type: Array,
      required: true
    }
  },
  setup(props, { emit }) {
    const currentCategory = ref('all')
    const selectedTemplate = ref(null)
    const templates = ref([])

    // 初始化模板列表
    const initTemplates = () => {
      const templateList = []
      // 实际的类别和模板数量
      const templateStructure = {
        'protect': [1],      // protect目录下只有1个模板
        'education': [1]     // education目录下只有1个模板
      }

      Object.entries(templateStructure).forEach(([category, templateNumbers]) => {
        templateNumbers.forEach(num => {
          const templatePath = `/src/views/deepseek/images/ppt/${category}/${num}`
          templateList.push({
            id: `${category}-${num}`,
            category: category,
            viewImage: `${templatePath}/view.png`,
            startImage: `${templatePath}/start.png`,
            contentImage: `${templatePath}/content.png`,
            endImage: `${templatePath}/end.png`
          })
        })
      })
      templates.value = templateList
    }

    // 获取所有类别
    const categories = computed(() => {
      return ['all', ...new Set(templates.value.map(t => t.category))]
    })

    // 过滤后的模板列表
    const filteredTemplates = computed(() => {
      if (currentCategory.value === 'all') {
        return templates.value
      }
      return templates.value.filter(t => t.category === currentCategory.value)
    })

    // 选择模板
    const selectTemplate = (template) => {
      selectedTemplate.value = template
    }

    // 确认选择
    const handleConfirm = () => {
      if (!selectedTemplate.value) return
      emit('select', {
        template: selectedTemplate.value,
        outline: props.outline
      })
    }

    onMounted(() => {
      initTemplates()
    })

    return {
      currentCategory,
      categories,
      filteredTemplates,
      selectedTemplate,
      selectTemplate,
      handleConfirm
    }
  }
}
</script>

<style scoped lang="scss">
.template-selector {
  width: 100%;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;

  .header {
    padding: 16px 24px;
    border-bottom: 1px solid #eee;

    .title {
      font-size: 16px;
      color: #333;
      font-weight: 500;
    }
  }

  .category-nav {
    padding: 12px 24px;
    display: flex;
    gap: 12px;
    border-bottom: 1px solid #eee;

    .category-item {
      padding: 6px 16px;
      border-radius: 16px;
      cursor: pointer;
      font-size: 14px;
      color: #666;
      background: #f5f7fa;

      &:hover {
        color: #409EFF;
        background: #ecf5ff;
      }

      &.active {
        color: #fff;
        background: #409EFF;
      }
    }
  }

  .templates-container {
    flex: 1;
    overflow: auto;
    padding: 24px;

    .templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 24px;

      .template-item {
        aspect-ratio: 16/9;
        border: 1px solid #eee;
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border-color: #409EFF;
        }

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }
    }
  }

  .action-buttons {
    padding: 16px 24px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    border-top: 1px solid #eee;
  }
}
</style> 