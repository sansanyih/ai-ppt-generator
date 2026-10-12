<template>
  <div class="reading-analyzer">
    <el-button 
      type="primary" 
      size="small" 
      @click="showUploadDialog"
    >
      阅读分析
    </el-button>

    <el-dialog
      v-model="dialogVisible"
      title="上传文件进行分析"
      width="80%"
      :close-on-click-modal="false"
      :destroy-on-close="true"
    >
      <div class="upload-container">
        <el-upload
          ref="uploadRef"
          class="upload-area"
          drag
          action="#"
          :auto-upload="false"
          :on-change="handleFileChange"
          :limit="1"
          :accept="'.pdf,.txt,.docx,.doc,.pptx,.xlsx,.xls'"
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">
            拖拽文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持上传PDF、TXT、Word(.docx)、PowerPoint(.pptx)、Excel(.xlsx)
            </div>
          </template>
        </el-upload>

        <el-alert
          v-if="selectedFile && selectedFile.name.endsWith('.pdf')"
          title="PDF文件提示"
          type="info"
          :closable="false"
          description="PDF文件解析可能受到限制，特别是对于扫描件或加密PDF。如遇到问题，您可以在提取内容后手动编辑再提交。"
          show-icon
        >
        </el-alert>

        <div class="selected-file" v-if="selectedFile">
          <div>已选择: {{ selectedFile.name }}</div>
          <div class="file-size">{{ formatFileSize(selectedFile.size) }}</div>
        </div>

        <div class="pdf-progress" v-if="pdfProcessing">
          <el-progress 
            :percentage="pdfProgress" 
            :format="progressFormat"
            :stroke-width="15"
            status="success"
          ></el-progress>
          <div class="progress-text">正在解析PDF文件，请稍候...</div>
        </div>

        <!-- 显示已提取的文本内容，允许用户编辑 -->
        <div v-if="extractedContent && !pdfProcessing" class="extracted-content-container">
          <h3>提取的文本内容 <small>(可编辑)</small></h3>
          <el-alert
            title="请检查并编辑提取的内容"
            type="warning"
            :closable="false"
            description="PDF文本提取可能不完美，请检查内容是否正确，并在需要时进行编辑。编辑完成后点击'提交分析'按钮。"
            show-icon
            style="margin-bottom: 15px;"
          >
          </el-alert>
          <el-input
            v-model="extractedContent"
            type="textarea"
            :rows="15"
            placeholder="提取的文本内容将显示在这里，您可以编辑后再提交分析"
          ></el-input>
        </div>

        <div class="upload-actions">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button 
            v-if="!extractedContent && !pdfProcessing"
            type="primary" 
            @click="extractFileContent" 
            :disabled="!selectedFile || analyzing"
            :loading="extracting"
          >
            提取内容
          </el-button>
          <el-button 
            v-if="extractedContent && !pdfProcessing"
            type="success" 
            @click="analyzeExtractedContent" 
            :disabled="!extractedContent || analyzing"
            :loading="analyzing"
          >
            提交分析
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { UploadFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
// 以下重依赖（pdfjs-dist 1MB+ / mammoth / xlsx / jszip）全部改为按需加载：
// 只有用户真的上传了对应格式的文件时才下载，避免打进首屏包。
let pdfjsLib = null;

async function loadPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    // 设置worker路径 - 使用CDN路径而不是本地导入
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
  return pdfjsLib;
}

// 添加辅助函数 - 用于清理PDF提取的文本
function cleanPdfText(text) {
  if (!text) return '';
  
  return text
    // 替换连续的空白字符为单个空格
    .replace(/\s+/g, ' ')
    // 替换特殊Unicode控制字符
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\uFEFF]/g, '')
    // 替换特殊破折号和引号为标准版本
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // 处理常见的乱码组合
    .replace(/\uFFFD/g, '') // 删除替换字符
    .replace(/□/g, '') // 删除方块字符
    .trim();
}

// 添加中文相关字符检测
function isChineseDocument(text) {
  // 检测文本中是否包含中文字符
  const chineseRegex = /[\u4E00-\u9FFF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\u2CEB0-\u2EBEF]/;
  return chineseRegex.test(text);
}

// 添加扫描PDF检测
function isLikelyScanPdf(textContent, pageCount) {
  // 如果文本内容几乎为空但有多个页面，可能是扫描PDF
  if (textContent.trim().length < 100 && pageCount > 1) {
    return true;
  }
  
  // 文本密度检测（每页平均字符数）
  const textDensity = textContent.length / pageCount;
  if (textDensity < 200) { // 如果每页平均字符数很少，可能是扫描PDF
    return true;
  }
  
  // 检测常见OCR错误模式（随机字符、乱码）
  const randomCharPattern = /[^\w\s\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF,.;:'"!?()[\]{}]/g;
  const randomCharMatches = textContent.match(randomCharPattern) || [];
  const randomCharRatio = randomCharMatches.length / textContent.length;
  
  return randomCharRatio > 0.1; // 如果随机字符比例高，可能是扫描PDF的OCR结果
}

// 智能分段处理
function formatPdfText(text) {
  if (!text) return '';
  
  // 多级清理
  text = cleanPdfText(text);
  
  // 智能段落处理
  return text
    // 确保段落间有一致的空行
    .replace(/\n{3,}/g, '\n\n')
    // 处理可能的分页符
    .replace(/\f/g, '\n\n')
    // 移除行尾连字符(-)后紧跟换行的情况
    .replace(/-\n([a-zA-Z])/g, '$1');
}

export default {
  name: 'ReadingAnalyzer',
  components: {
    UploadFilled
  },
  props: {
    messages: {
      type: Array,
      default: () => []
    },
    inputText: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      dialogVisible: false,
      selectedFile: null,
      fileContent: '',
      extractedContent: '',
      analyzing: false,
      extracting: false,
      pdfProcessing: false,
      pdfProgress: 0
    };
  },
  computed: {
    hasMessages() {
      return this.messages && this.messages.length > 0;
    }
  },
  methods: {
    showUploadDialog() {
      this.dialogVisible = true;
      this.selectedFile = null;
      this.extractedContent = '';
    },
    handleFileChange(file) {
      this.selectedFile = file.raw;
      this.extractedContent = '';
    },
    formatFileSize(size) {
      if (size < 1024) {
        return size + ' B';
      } else if (size < 1024 * 1024) {
        return (size / 1024).toFixed(2) + ' KB';
      } else {
        return (size / (1024 * 1024)).toFixed(2) + ' MB';
      }
    },
    progressFormat(percentage) {
      return percentage === 100 ? '完成' : `${percentage}%`;
    },
    async extractFileContent() {
      if (!this.selectedFile) {
        ElMessage.warning('请先选择文件');
        return;
      }

      this.extracting = true;
      
      try {
        // 读取文件内容
        const content = await this.readFileContent(this.selectedFile);
        this.extractedContent = content;
        
        if (content.trim().length < 50) {
          ElMessage.warning('提取的内容很少，可能是扫描件或加密文件，请考虑手动输入关键内容');
        } else {
          // 根据文件类型显示不同消息
          let fileType = 'TXT';
          if (this.selectedFile.name.endsWith('.pdf')) {
            fileType = 'PDF';
          } else if (this.selectedFile.name.endsWith('.docx')) {
            fileType = 'Word';
          } else if (this.selectedFile.name.endsWith('.pptx')) {
            fileType = 'PowerPoint';
          } else if (this.selectedFile.name.endsWith('.xlsx') || this.selectedFile.name.endsWith('.xls')) {
            fileType = 'Excel';
          }
          ElMessage.success(`${fileType}文件内容提取成功，请检查并编辑后提交分析`);
        }
      } catch (error) {
        console.error('文件内容提取失败:', error);
        ElMessage.error('文件内容提取失败，请重试');
      } finally {
        this.extracting = false;
      }
    },
    async analyzeExtractedContent() {
      if (!this.extractedContent || this.extractedContent.trim().length === 0) {
        ElMessage.warning('没有内容可供分析，请先提取文件内容');
        return;
      }

      this.analyzing = true;
      
      try {
        // 准备分析提示
        let fileType = this.selectedFile.type || 
                      (this.selectedFile.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain');
        
        // 创建用于显示在对话框中的简短提示
        let displayPrompt = `我上传了一个${fileType.includes('pdf') ? 'PDF' : 'TXT'}文件"${this.selectedFile.name}"（大小：${this.formatFileSize(this.selectedFile.size)}），请分析其内容并提供摘要。`;
        
        // 创建发送给AI的完整提示（包含用户编辑后的文件内容）
        let aiPrompt = `${displayPrompt}\n\n`;
        
        if (this.extractedContent.length > 8000) {
          // 如果内容太长，截取前8000字符
          aiPrompt += "以下是文件的前部分内容：\n\n" + this.extractedContent.substring(0, 8000) + "\n\n[内容过长已截断]";
        } else {
          aiPrompt += "以下是文件的完整内容：\n\n" + this.extractedContent;
        }
        
        // 发送分析请求
        this.$emit('analyze-request', {
          displayPrompt, // 显示在对话框中的简短提示
          aiPrompt       // 发送给AI的完整提示（包含文件内容）
        });
        this.dialogVisible = false;
        
      } catch (error) {
        console.error('分析请求发送失败:', error);
        ElMessage.error('分析请求发送失败，请重试');
      } finally {
        this.analyzing = false;
      }
    },
    async readFileContent(file) {
      return new Promise((resolve, reject) => {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          // 处理PDF文件
          const fileReader = new FileReader();
          
          fileReader.onload = async (event) => {
            try {
              this.pdfProcessing = true;
              this.pdfProgress = 5; // 开始解析
              
              const typedArray = new Uint8Array(event.target.result);
              
              // 按需加载 pdfjs-dist
              const pdfjs = await loadPdfjs();

              // 加载PDF文档
              const loadingTask = pdfjs.getDocument({
                data: typedArray,
                // 添加额外选项以提高文本提取质量
                cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/cmaps/',
                cMapPacked: true,
                standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/standard_fonts/',
                disableFontFace: false,
                useSystemFonts: true,
                // 添加更多PDF.js选项以提高中文提取质量
                verbosity: 0,
                ignoreErrors: true,
                isEvalSupported: true
              });
              
              this.pdfProgress = 20;
              
              const pdf = await loadingTask.promise;
              this.pdfProgress = 30;
              
              let textContent = '';
              const numPages = pdf.numPages;
              
              // 添加文档元数据
              try {
                const metadata = await pdf.getMetadata();
                if (metadata && metadata.info) {
                  const info = metadata.info;
                  textContent += `标题: ${info.Title || '未知'}\n`;
                  textContent += `作者: ${info.Author || '未知'}\n`;
                  textContent += `页数: ${numPages}\n\n`;
                }
              } catch (e) {
                console.warn('无法提取PDF元数据', e);
              }
              
              // 提取PDF的文本内容，最多处理前20页
              const pagesToExtract = Math.min(numPages, 20);
              let sampleText = ''; // 用于检测是否为中文文档
              let hasExtractedContent = false; // 标记是否成功提取了内容
              
              // 使用更优化的文本提取方法
              for (let i = 1; i <= pagesToExtract; i++) {
                try {
                  const page = await pdf.getPage(i);
                  
                  // 获取文本内容
                  const content = await page.getTextContent({
                    normalizeWhitespace: true,
                    disableCombineTextItems: false
                  });
                  
                  // 处理文本布局 - 考虑项目的垂直位置，尝试重建段落
                  const items = content.items;
                  
                  // 如果页面上有文本，则标记为成功提取
                  if (items && items.length > 0) {
                    hasExtractedContent = true;
                  }
                  
                  let lastY = null;
                  let pageText = '';
                  
                  for (let j = 0; j < items.length; j++) {
                    const item = items[j];
                    
                    // 处理垂直位置变化 - 可能是新段落
                    if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) {
                      pageText += '\n';
                    } else if (j > 0 && !pageText.endsWith(' ')) {
                      // 在同一行的相邻单词之间添加空格，但中文除外
                      if (!isChineseDocument(item.str)) {
                        pageText += ' ';
                      }
                    }
                    
                    // 添加文本，并清理可能的特殊字符
                    pageText += cleanPdfText(item.str);
                    lastY = item.transform[5];
                  }
                  
                  // 第一页样本用于语言检测
                  if (i === 1) {
                    sampleText = pageText.substring(0, 1000);
                  }
                  
                  textContent += `--- 第${i}页 ---\n${pageText}\n\n`;
                  
                  // 更新进度
                  this.pdfProgress = 30 + Math.floor((i / pagesToExtract) * 70);
                } catch (e) {
                  console.error(`提取第${i}页时出错:`, e);
                  textContent += `--- 第${i}页 [提取失败] ---\n\n`;
                }
              }
              
              if (numPages > 20) {
                textContent += `\n[PDF文件共${numPages}页，仅显示前20页内容]\n`;
              }
              
              // 最终处理文本
              const isChinese = isChineseDocument(sampleText);
              textContent = formatPdfText(textContent);
              
              // 如果是中文文档，移除段落间可能错误添加的空格
              if (isChinese) {
                textContent = textContent.replace(/([^\x00-\x7F]) ([^\x00-\x7F])/g, '$1$2');
              }
              
              // 检测是否可能是扫描PDF
              const isProbablyScanPdf = isLikelyScanPdf(textContent, numPages);
              
              // 如果是扫描PDF或没有成功提取内容，添加提示
              if (isProbablyScanPdf || !hasExtractedContent) {
                textContent = `[提示：该PDF可能是扫描件或图片PDF，提取的文本可能不完整，请手动编辑补充关键内容]\n\n${textContent}`;
              }
              
              this.pdfProgress = 100;
              setTimeout(() => {
                this.pdfProcessing = false;
                this.pdfProgress = 0;
              }, 500);
              
              resolve(textContent);
            } catch (error) {
              console.error('PDF解析错误:', error);
              this.pdfProcessing = false;
              this.pdfProgress = 0;
              resolve(`[无法解析PDF文件: ${file.name}，大小: ${this.formatFileSize(file.size)}]\n错误信息: ${error.message}\n\n该PDF可能是加密的、损坏的或使用了特殊格式。请尝试手动输入文档的关键内容，或将PDF转换为文本后再上传。`);
            }
          };
          
          fileReader.onerror = () => {
            this.pdfProcessing = false;
            this.pdfProgress = 0;
            reject(new Error('PDF文件读取失败'));
          };
          
          fileReader.readAsArrayBuffer(file);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                  file.name.endsWith('.docx')) {
          // 处理Word文档(.docx)
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              this.pdfProcessing = true; // 复用进度指示器
              this.pdfProgress = 10;
              
              const arrayBuffer = e.target.result;
              
              // 按需加载 mammoth.js 解析 docx
              const mammoth = (await import('mammoth')).default;
              const result = await mammoth.extractRawText({arrayBuffer});
              const text = result.value;
              const warnings = result.messages;
              
              if (warnings.length > 0) {
                console.warn('Word文档转换警告:', warnings);
              }
              
              this.pdfProgress = 100;
              setTimeout(() => {
                this.pdfProcessing = false;
                this.pdfProgress = 0;
              }, 500);
              
              // 提取文档内容，加入一些格式化
              let formattedText = `--- Word文档: ${file.name} ---\n\n`;
              formattedText += text;
              
              resolve(formattedText);
            } catch (error) {
              console.error('Word文档解析错误:', error);
              this.pdfProcessing = false;
              this.pdfProgress = 0;
              resolve(`[无法解析Word文档: ${file.name}]\n错误信息: ${error.message}\n\n请尝试手动复制文档内容。`);
            }
          };
          
          reader.onerror = () => {
            this.pdfProcessing = false;
            reject(new Error('Word文档读取失败'));
          };
          
          reader.readAsArrayBuffer(file);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          // 处理Excel文件
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              this.pdfProcessing = true; // 复用进度指示器
              this.pdfProgress = 10;
              
              const data = new Uint8Array(e.target.result);
              
              // 按需加载 XLSX 解析 Excel
              const XLSX = await import('xlsx');
              const workbook = XLSX.read(data, { type: 'array' });
              
              // 提取所有工作表数据
              let formattedText = `--- Excel文件: ${file.name} ---\n\n`;
              
              workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                formattedText += `== 工作表: ${sheetName} ==\n\n`;
                
                // 格式化表格数据
                sheetData.forEach(row => {
                  formattedText += row.join('\t') + '\n';
                });
                
                formattedText += '\n';
              });
              
              this.pdfProgress = 100;
              setTimeout(() => {
                this.pdfProcessing = false;
                this.pdfProgress = 0;
              }, 500);
              
              resolve(formattedText);
            } catch (error) {
              console.error('Excel文件解析错误:', error);
              this.pdfProcessing = false;
              this.pdfProgress = 0;
              resolve(`[无法解析Excel文件: ${file.name}]\n错误信息: ${error.message}\n\n请尝试手动复制文件内容。`);
            }
          };
          
          reader.onerror = () => {
            this.pdfProcessing = false;
            reject(new Error('Excel文件读取失败'));
          };
          
          reader.readAsArrayBuffer(file);
        } else if (file.name.endsWith('.pptx')) {
          // 处理PowerPoint文件 - 使用更高级的方法
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              this.pdfProcessing = true; // 复用进度指示器
              this.pdfProgress = 10;
              
              const arrayBuffer = e.target.result;
              let formattedText = `--- PowerPoint文件: ${file.name} ---\n\n`;
              
              // 按需加载 JSZip 解压 PPTX（PPTX 本质上是 ZIP）
              const JSZip = (await import('jszip')).default;
              const zip = new JSZip();
              const pptx = await zip.loadAsync(arrayBuffer);
              this.pdfProgress = 30;
              
              // 提取幻灯片内容
              const slideFiles = [];
              let slideCount = 0;
              
              // 查找所有幻灯片文件
              pptx.forEach((relativePath, zipEntry) => {
                if (relativePath.match(/ppt\/slides\/slide[0-9]+\.xml/)) {
                  slideFiles.push({
                    path: relativePath,
                    num: parseInt(relativePath.match(/slide([0-9]+)\.xml/)[1])
                  });
                  slideCount++;
                }
              });
              
              // 按幻灯片编号排序
              slideFiles.sort((a, b) => a.num - b.num);
              
              this.pdfProgress = 40;
              
              if (slideCount === 0) {
                formattedText += "未检测到幻灯片内容，请手动输入。\n";
              } else {
                formattedText += `检测到 ${slideCount} 张幻灯片。\n\n`;
                
                // 处理每个幻灯片
                for (let i = 0; i < slideFiles.length; i++) {
                  try {
                    const slideFile = slideFiles[i];
                    const slideXml = await pptx.file(slideFile.path).async("string");
                    
                    // 尝试获取对应的备注页
                    let notesContent = '';
                    const notesPath = `ppt/notesSlides/notesSlide${slideFile.num}.xml`;
                    if (pptx.file(notesPath)) {
                      try {
                        const notesXml = await pptx.file(notesPath).async("string");
                        notesContent = this.extractTextFromSlideXml(notesXml);
                        if (notesContent) {
                          notesContent = `【备注】\n${notesContent}\n`;
                        }
                      } catch (notesError) {
                        console.warn(`提取幻灯片${slideFile.num}备注失败:`, notesError);
                      }
                    }
                    
                    // 从XML中提取文本内容
                    const textContent = this.extractTextFromSlideXml(slideXml);
                    
                    formattedText += `【幻灯片 ${slideFile.num}】\n`;
                    if (textContent.trim()) {
                      formattedText += textContent + "\n";
                    } else {
                      formattedText += "[该幻灯片无文本内容或包含图片]\n";
                    }
                    
                    // 添加备注内容（如果有）
                    if (notesContent) {
                      formattedText += notesContent;
                    }
                    
                    formattedText += "\n";
                    
                    // 更新进度
                    this.pdfProgress = 40 + Math.floor((i / slideFiles.length) * 50);
                  } catch (slideError) {
                    console.warn(`解析幻灯片 ${slideFiles[i].num} 失败:`, slideError);
                    formattedText += `【幻灯片 ${slideFiles[i].num}】 [解析失败]\n\n`;
                  }
                }
              }
              
              formattedText += "注意：PowerPoint文本提取可能不完整，建议补充重要内容。\n";
              
              this.pdfProgress = 100;
              setTimeout(() => {
                this.pdfProcessing = false;
                this.pdfProgress = 0;
              }, 500);
              
              resolve(formattedText);
            } catch (error) {
              console.error('PowerPoint文件解析错误:', error);
              this.pdfProcessing = false;
              this.pdfProgress = 0;
              resolve(`[无法解析PowerPoint文件: ${file.name}]\n错误信息: ${error.message}\n\n请手动输入幻灯片内容，按以下格式：\n\n幻灯片1: [标题]\n[内容]\n\n幻灯片2: [标题]\n[内容]`);
            }
          };
          
          reader.onerror = () => {
            this.pdfProcessing = false;
            reject(new Error('PowerPoint文件读取失败'));
          };
          
          reader.readAsArrayBuffer(file);
        } else {
          // 对于文本文件，直接读取内容
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve(e.target.result);
          };
          reader.onerror = (e) => {
            reject(new Error('文件读取失败'));
          };
          reader.readAsText(file, 'UTF-8'); // 明确指定UTF-8编码
        }
      });
    },
    // 添加从幻灯片XML提取文本的方法
    extractTextFromSlideXml(slideXml) {
      try {
        // 处理特殊XML字符
        slideXml = slideXml.replace(/&amp;/g, '&')
                           .replace(/&lt;/g, '<')
                           .replace(/&gt;/g, '>')
                           .replace(/&quot;/g, '"')
                           .replace(/&apos;/g, "'");
        
        // 提取所有文本元素 - 包括带属性的文本标签和特殊格式
        // PowerPoint中的文本可能在不同类型的标签中，我们尝试捕获主要的几种
        const patterns = [
          /<a:t>([^<]*)<\/a:t>/g,                // 标准文本
          /<a:t [^>]*>([^<]*)<\/a:t>/g,          // 带属性的文本
          /<a:fld [^>]*>([^<]*)<\/a:fld>/g,      // 域标签中的文本
          /<a:p>[\s\S]*?<a:t[^>]*>([\s\S]*?)<\/a:t>[\s\S]*?<\/a:p>/g  // 段落中的文本
        ];
        
        let allText = [];
        
        // 使用多种模式匹配文本内容
        for (const pattern of patterns) {
          const matches = Array.from(slideXml.matchAll(pattern));
          for (const match of matches) {
            if (match[1] && match[1].trim()) {
              allText.push(match[1].trim());
            }
          }
        }
        
        // 提取标题等特殊元素 - 尝试识别幻灯片标题
        let title = '';
        const titleMatch = slideXml.match(/<p:cSld[^>]*name="([^"]+)"/);
        if (titleMatch && titleMatch[1]) {
          title = `【标题】${titleMatch[1]}\n`;
        }
        
        // 组合所有文本内容
        return title + allText.join('\n');
      } catch (e) {
        console.warn('XML文本提取错误:', e);
        return '';
      }
    }
  }
};
</script>

<style scoped lang="scss">
.reading-analyzer {
  margin-left: 5px;
}

.upload-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.upload-area {
  width: 100%;
}

.selected-file {
  background-color: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
  
  .file-size {
    color: #909399;
    margin-top: 5px;
    font-size: 12px;
  }
}

.upload-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}

.pdf-progress {
  margin: 15px 0;
  
  .progress-text {
    margin-top: 8px;
    color: #409EFF;
    font-size: 14px;
    text-align: center;
  }
}

.extracted-content-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 15px;
  background-color: #f8f9fa;
  
  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 16px;
    
    small {
      font-weight: normal;
      color: #909399;
      font-size: 14px;
    }
  }
}
</style> 