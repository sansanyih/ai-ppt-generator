<template>
  <div class="ppt-generator">
    <el-button
      v-if="showGenerateButton"
      type="primary"
      size="small"
      @click="handleGeneratePPT"
    >
      生成PPT
    </el-button>

    <el-dialog
      v-model="showTemplateSelector"
      title="选择PPT模板"
      width="80%"
      :close-on-click-modal="false"
      :destroy-on-close="true"
    >
      <PPTTemplateSelector 
        :outline="currentOutline"
        @select="handleTemplateSelect"
        @close="showTemplateSelector = false"
      />
    </el-dialog>
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import PPTTemplateSelector from './PPTTemplateSelector.vue'
import pptxgen from 'pptxgenjs'
import { ElMessage } from 'element-plus'

export default {
  name: 'PPTGenerator',
  components: {
    PPTTemplateSelector
  },
  props: {
    messages: {
      type: Array,
      required: true
    },
    inputText: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const showGenerateButton = ref(false)
    const showTemplateSelector = ref(false)
    const currentOutline = ref([])

    // 监听输入文本，检测是否包含PPT相关关键词
    watch(() => props.inputText, (newVal) => {
      if (newVal && (
        newVal.toLowerCase().includes('ppt') || 
        newVal.toLowerCase().includes('演示') || 
        newVal.toLowerCase().includes('幻灯片')
      )) {
        showGenerateButton.value = true
      } else {
        showGenerateButton.value = false
      }
    })

    // 从消息中提取PPT大纲
    const extractOutlineFromMessages = () => {
      const outline = []
      const messages = props.messages
      
      // 查找最后一个助手回复
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i]
        if (message.role === 'assistant') {
          // 分析消息内容，提取大纲
          const content = message.content
          const lines = content.split('\n')
          
          let currentSection = null
          
          for (const line of lines) {
            const trimmedLine = line.trim()
            // 检测标题（以数字、减号、星号或点开头的行）
            if (/^[\d\-\*\.\•]/.test(trimmedLine)) {
              if (currentSection) {
                outline.push(currentSection)
              }
              currentSection = {
                title: trimmedLine.replace(/^[\d\-\*\.\•]+\.?\s*/, ''), // 移除序号和符号
                content: ''
              }
            } else if (currentSection && trimmedLine) {
              // 将非空行添加到当前章节的内容中
              currentSection.content += trimmedLine + '\n'
            }
          }
          
          // 添加最后一个章节
          if (currentSection) {
            outline.push(currentSection)
          }
          
          break
        }
      }
      
      // 如果没有找到大纲，创建一个默认的
      if (outline.length === 0) {
        outline.push({
          title: '演示文稿',
          content: '请先生成PPT大纲'
        })
      }
      
      return outline
    }

    // 处理生成PPT按钮点击
    const handleGeneratePPT = () => {
      try {
        // 从对话历史中提取大纲
        const outline = extractOutlineFromMessages()
        console.log("Extracted outline:", outline)
        
        if (!outline.length) {
          ElMessage.warning('未找到有效的PPT大纲，请先生成大纲')
          return
        }
        
        // 保存当前大纲并显示模板选择器
        currentOutline.value = outline
        showTemplateSelector.value = true
        console.log("Template selector shown")
      } catch (error) {
        console.error('准备生成PPT时出错：', error)
        ElMessage.error('生成PPT失败，请重试！')
      }
    }

    // 处理模板选择
    const handleTemplateSelect = async ({ template, outline }) => {
      try {
        showTemplateSelector.value = false
        
        // 创建新的PPT实例
        const pres = new pptxgen()
        
        // 添加首页
        const firstSlide = pres.addSlide()
        firstSlide.background = { path: template.startImage }
        firstSlide.addText(outline[0]?.title || "PPT标题", {
          x: 0.5,
          y: 0.5,
          w: '90%',
          fontSize: 44,
          bold: true,
          color: '363636',
          align: 'center'
        })

        // 添加内容页
        for (let i = 1; i < outline.length; i++) {
          const slide = pres.addSlide()
          slide.background = { path: template.contentImage }
          
          if (outline[i].title) {
            slide.addText(outline[i].title, {
              x: 0.5,
              y: 0.5,
              w: '90%',
              fontSize: 32,
              bold: true,
              color: '363636'
            })
          }
          
          if (outline[i].content) {
            slide.addText(outline[i].content, {
              x: 0.5,
              y: 1.5,
              w: '90%',
              fontSize: 24,
              color: '666666',
              bullet: true
            })
          }
        }

        // 添加结束页
        const lastSlide = pres.addSlide()
        lastSlide.background = { path: template.endImage }
        lastSlide.addText("感谢观看", {
          x: 0.5,
          y: 0.5,
          w: '90%',
          fontSize: 44,
          bold: true,
          color: '363636',
          align: 'center'
        })
        
        // 保存PPT
        await pres.writeFile('presentation.pptx')
        ElMessage.success('PPT生成成功！')
      } catch (error) {
        console.error('生成PPT时出错：', error)
        ElMessage.error('生成PPT失败，请重试！')
      }
    }

    return {
      showGenerateButton,
      showTemplateSelector,
      currentOutline,
      handleGeneratePPT,
      handleTemplateSelect
    }
  }
}
</script>

<style scoped lang="scss">
.ppt-generator {
  margin-left: 5px;
}

:deep(.el-dialog__body) {
  padding: 0;
  height: 70vh;
}
</style> 