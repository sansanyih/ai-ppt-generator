<template>
  <div class="inner-html-container">
    <LoginComp v-if="!isLoggedIn" @login-success="handleLoginSuccess" />
    <div class="page" v-else>
      <div class="tips">
        <div class="title">DeepSeek-GPT</div>
        <div class="right-section">
          <div class="desc" v-if="!isMobile">
            右边是退出登录
          </div>
          <el-button
            type="danger"
            size="small"
            @click="handleLogout"
            style="margin-left: 16px;"
          >
            退出登录
          </el-button>
          <div @click="handleClearStorage" v-if="isMobile" class="pointer">清空</div>
        </div>
      </div>
      <div class="grid-space-between" :class="!isMobile ? 'grid-box' : ''">
        <div class="left-container" v-if="!isMobile">
          <el-button
              type="success"
              style="width: 100%"
              @click="handleAddSession"
          >新建对话</el-button
          >
          <div class="session-area">
            <div
                class="session-item"
                :class="activeIndex == index ? 'session-item-active' : ''"
                v-for="(item, index) in sessionList"
                :key="index"
                @click="handleChangeSessionIndex(index)"
            >
              <span
                  :class="activeIndex == index ? 'active-node' : 'normal-node'"
                  v-if="editIndex != index"
              >{{ item.title }}</span
              >
              <el-input
                  :ref="`renameRef_${index}`"
                  autofocus
                  v-model="item.title"
                  v-else
                  size="small"
                  style="width: 120px"
                  @blur="editIndex = -1"
                  @change="editIndex = -1"
              />
              <div class="icon-box">
                <!-- 重命名 -->
                <el-icon
                    class="icon"
                    color="#E6A23C"
                    @click.stop="handleFocusInput(index)"
                >
                  <BrushFilled />
                </el-icon>
                <!-- 删除 -->
                <el-icon
                    class="icon"
                    color="#F56C6C"
                    @click.stop="handleDeleteSession(index)"
                ><DeleteFilled
                /></el-icon>
              </div>
            </div>
          </div>
        </div>
        <div class="container">
          <div class="message-area">
            <MessageComp
                ref="messageRef"
                :message="queryInfos.messages"
            ></MessageComp>
          </div>
          <div class="user-tokens" :class="isMobile ? 'left-space' : ''">
            <div class="tokens-row">
              <span>当前余额为：￥{{ totalAmt || 0 }}</span>
              <div class="buttons-container">
                <PPTGenerator 
                  :messages="queryInfos.messages"
                  :input-text="queryKeys"
                />
                <ReadingAnalyzer
                  :messages="queryInfos.messages"
                  :input-text="queryKeys"
                  @analyze-request="handleAnalyzeRequest"
                />
                <ChartGenerator 
                  @send-to-chat="handleChartDataAnalysis"
                />
              </div>
            </div>
          </div>
          <div class="input-area" :class="isMobile ? 'left-space' : ''">
            <el-input
                v-model="queryKeys"
                id="keyInput"
                placeholder="请输入内容"
            />
            <el-button
                style="height: 40px"
                type="primary"
                @click="handleRequest"
                :disabled="!queryKeys"
                :loading="loading"
            >
              <el-icon><Promotion /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
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
  </div>
</template>

<script>
import OpenAI from "openai";
import MessageComp from "./components/messageComp.vue";
import LoginComp from "./components/LoginComp.vue";
import PPTTemplateSelector from "./components/PPTTemplateSelector.vue";
import PPTGenerator from "./components/PPTGenerator.vue";
import ReadingAnalyzer from "./components/ReadingAnalyzer.vue";
import ChartGenerator from "./components/ChartGenerator.vue";
import { Promotion, DeleteFilled, BrushFilled } from "@element-plus/icons-vue";
import { getTokens } from "@/api/modules/deepseek.js";
import { ElMessage, ElMessageBox } from "element-plus";
import MobileDetect from "mobile-detect";
import pptxgen from "pptxgenjs";

export default {
  components: { 
    MessageComp, 
    LoginComp,
    PPTTemplateSelector,
    PPTGenerator,
    ReadingAnalyzer,
    ChartGenerator,
    Promotion, 
    DeleteFilled, 
    BrushFilled 
  },
  data() {
    return {
      isLoggedIn: false,
      isMobile: false,
      renameValue: "",
      sessionList: [],
      activeIndex: -1,
      editIndex: -1, // 当前重命名的序号
      showGeneratePPT: false, // 是否显示生成PPT按钮

      totalAmt: 0, // 余额
      queryKeys: "",
      openai: null,
      loading: false,
      queryInfos: {
        // { role: "assistant", content: "You are a helpful assistant." }
        // {"role": "user", "content": "What's the highest mountain in the world?"}
        messages: [],
        model: "deepseek-chat",
        stream: true,
      },
      isKeyIn: false,
      // 密钥不再放前端：所有大模型请求统一走 /api
      // （本地由 vite.config.js 的 proxy 转发，线上由 Vercel Serverless 转发）
      showTemplateSelector: false,
      currentOutline: [],
    };
  },
  computed: {},
  created() {
    // 检查登录状态
    this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    // 所有VUE_APP_开头的变量会自动加载
    this.initSessionList();
    this.initIndex();
    this.initOpenAI();
    this.initToken();
    // 监测当前设备是不是手机
    const md = new MobileDetect(window.navigator.userAgent);
    this.isMobile = md.mobile();
    const _this = this;
    this.$nextTick(() => {
      document
          .getElementById("keyInput")
          .addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
              _this.handleRequest();
              event.preventDefault();
            }
          });
    });
  },
  mounted() {
    this.forceScrollToBottom();
  },
  watch: {
    sessionList: {
      handler(val) {
        const list = val.map((o, i) => {
          if (i == this.activeIndex) {
            return {
              ...o,
              messages: this.queryInfos.messages,
            };
          } else {
            return { ...o };
          }
        });
        localStorage.setItem("list", JSON.stringify(list));
      },
      deep: true,
      immediate: false,
    },
    activeIndex: {
      handler(val) {
        localStorage.setItem("index", JSON.stringify(val));
      },
      deep: true,
      immediate: false,
    },
  },
  methods: {
    handleLoginSuccess() {
      this.isLoggedIn = true;
    },
    handleLogout() {
      ElMessageBox.confirm('确认退出登录？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        // 清除登录状态
        localStorage.removeItem('isLoggedIn');
        this.isLoggedIn = false;
        // 清除会话数据
        this.handleClearStorage();
        ElMessage.success('已退出登录');
      }).catch(() => {});
    },
    // 手机端清空对话
    handleClearStorage() {
      localStorage.removeItem("list");
      localStorage.removeItem("index");
      this.queryInfos.messages = [];
      this.sessionList = [];
      this.activeIndex = -1;
    },
    // 初始化对话列表
    initSessionList() {
      this.sessionList = JSON.parse(localStorage.getItem("list") || "[]");
    },
    // 初始化当前序号
    initIndex() {
      const listLen = JSON.parse(localStorage.getItem("list") || "[]").length; // 对话列表
      const lastIndex = JSON.parse(localStorage.getItem("index") || "-1"); // 当前对话的序号
      if (listLen) {
        this.activeIndex = lastIndex || 0;
      } else {
        this.activeIndex = -1;
      }
      if (this.activeIndex != -1) {
        this.queryInfos.messages =
            this.sessionList[this.activeIndex].messages || []; // 获取当前对话历史记录
      }
    },
    // 新增session对话
    handleAddSession() {
      if (this.loading) {
        ElMessage({ type: "warning", message: "请当前问题查询完成后重试！" });
        return;
      }
      this.sessionList.push({
        title: `对话${this.sessionList.length + 1}`,
        crtTime: new Date(),
        messages: [],
      });
      this.queryInfos.messages = [];
      this.activeIndex = this.sessionList.length - 1;
    },
    // 删除对话
    handleDeleteSession(index = 0) {
      ElMessageBox.confirm("确认删除当前对话？", "警告", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }).then(() => {
        // 删除指定的对话
        this.sessionList.splice(index, 1);
        /**
         * 逻辑1:删除的当前选中的对话框，判断新的当前元素（原来的+1）是否存在，不存在则向前抓
         * 逻辑2:删除的非当前选中的(只判断小于，因为大于不影响当前展示内容)
         */
        if (index == this.activeIndex) {
          // 初始化index
          this.activeIndex = this.sessionList[index] ? index : --index;
        } else if (index < this.activeIndex) {
          this.activeIndex = --this.activeIndex;
        }
        // 更新页面数据展示
        this.queryInfos.messages =
            this.activeIndex > -1 ? this.sessionList[this.activeIndex] : [];
        this.handleChangeSessionIndex(this.activeIndex);
      }).catch((action) => {
      });
    },
    handleFocusInput(index) {
      const _this = this;
      this.editIndex = index;
      this.$nextTick(() => {
        _this.$refs[`renameRef_${index}`][0].focus();
      });
    },
    // 切换session对话序号
    handleChangeSessionIndex(index) {
      if (this.loading) {
        ElMessage({ type: "warning", message: "请当前问题查询完成后重试！" });
        return;
      }
      this.activeIndex = index;
      this.queryInfos.messages =
          this.sessionList[this.activeIndex]?.messages || [];
      this.forceScrollToBottom();
    },
    initOpenAI() {
      // baseURL 用相对路径 /api：服务端代理负责补上 Authorization
      //   · 本地开发：vite.config.js 的 server.proxy 转发到 api.deepseek.com
      //   · 线上部署：api/[...path].js（Vercel Edge Function）转发
      // apiKey 只是 SDK 的必填占位值，真正的密钥在服务端环境变量里，不会出现在前端 bundle
      this.openai = new OpenAI({
        baseURL: "/api",
        apiKey: "proxied-by-server",
        dangerouslyAllowBrowser: true,
      });
    },
    forceScrollToBottom() {
      this.$refs.messageRef.scrollBottom(true)
    },
    async initToken() {
      // 余额查询同样走 /api/user/balance，由服务端代理带上密钥
      const res = await getTokens({});
      const { balance_infos = [] } = res;
      balance_infos.forEach((o) => {
        this.totalAmt += Number(o.total_balance);
      });
    },
    // 点击进行提问
    async handleRequest(alternativeContent = null) {
      if (!this.queryKeys && !alternativeContent) return;
      if (!this.openai) this.initOpenAI();
      
      // 检查是否包含PPT相关关键词
      if (this.queryKeys && (this.queryKeys.toLowerCase().includes('ppt') || 
          this.queryKeys.toLowerCase().includes('演示') || 
          this.queryKeys.toLowerCase().includes('幻灯片'))) {
        this.showGeneratePPT = true;
      }

      // 查询当前是否存在对话窗口，不存在的话，新建一个对话窗口
      if (!this.sessionList.length) {
        await this.handleAddSession();
      }

      // 如果没有提供替代内容，则使用输入框的内容
      if (!alternativeContent) {
        // 1.向对话窗口添加对话信息(请求)
        this.queryInfos.messages.push({
          role: "user",
          content: this.queryKeys,
        });
        this.queryKeys = null;
      }
      
      // 滚动到底部
      this.forceScrollToBottom();

      try {
        // 2.请求服务进行提问
        this.loading = true;
        // 开始新回答时重置自动滚动
        this.$refs.messageRef.isAutoScroll = true;
        
        // 如果提供了替代内容，创建临时消息数组
        let requestMessages = this.queryInfos.messages;
        if (alternativeContent) {
          requestMessages = [...this.queryInfos.messages];
          // 替换最后一条消息
          requestMessages[requestMessages.length - 1] = {
            role: "user",
            content: alternativeContent
          };
        }
        
        console.log("发送API请求，消息数量:", requestMessages.length);
        
        const response = await this.openai.chat.completions.create({
          model: this.queryInfos.model,
          messages: requestMessages,
          stream: this.queryInfos.stream
        });
        
        this.queryInfos.messages.push({ role: "assistant", content: "" });
        for await (const part of response) {
          this.queryInfos.messages[
          this.queryInfos.messages.length - 1
              ].content += part.choices[0].delta.content;
          // 每次更新后立即滚动
          this.$refs.messageRef.scrollBottom();
        }
        this.$refs.messageRef.scrollBottom();
        // 更新缓存数据
        this.sessionList[this.activeIndex].messages = this.queryInfos.messages;
        this.loading = false;
      } catch (error) {
        console.error('请求失败:', error);
        this.loading = false;
        this.queryInfos.messages.push({
          role: "assistant",
          content: `加载失败,请稍后重试! 错误详情: ${error.message || "未知错误"}`,
        });
      }
    },
    // 生成PPT方法
    async generatePPT() {
      console.log("generatePPT called"); // 添加调试日志
      try {
        // 从对话历史中提取大纲
        const outline = this.extractOutlineFromMessages();
        console.log("Extracted outline:", outline); // 添加调试日志
        
        if (!outline.length) {
          ElMessage.warning('未找到有效的PPT大纲，请先生成大纲');
          return;
        }
        
        // 保存当前大纲并显示模板选择器
        this.currentOutline = outline;
        this.showTemplateSelector = true;
        console.log("Template selector shown"); // 添加调试日志
      } catch (error) {
        console.error('准备生成PPT时出错：', error);
        ElMessage.error('生成PPT失败，请重试！');
      }
    },

    // 处理模板选择
    async handleTemplateSelect({ template, outline }) {
      try {
        this.showTemplateSelector = false;
        
        // 创建新的PPT实例
        const pres = new pptxgen();
        
        // 添加首页
        const firstSlide = pres.addSlide();
        firstSlide.background = { path: template.startImage };
        firstSlide.addText(outline[0]?.title || "PPT标题", {
          x: 0.5,
          y: 0.5,
          w: '90%',
          fontSize: 44,
          bold: true,
          color: '363636',
          align: 'center'
        });

        // 添加内容页
        for (let i = 1; i < outline.length; i++) {
          const slide = pres.addSlide();
          slide.background = { path: template.contentImage };
          
          if (outline[i].title) {
            slide.addText(outline[i].title, {
              x: 0.5,
              y: 0.5,
              w: '90%',
              fontSize: 32,
              bold: true,
              color: '363636'
            });
          }
          
          if (outline[i].content) {
            slide.addText(outline[i].content, {
              x: 0.5,
              y: 1.5,
              w: '90%',
              fontSize: 24,
              color: '666666',
              bullet: true
            });
          }
        }

        // 添加结束页
        const lastSlide = pres.addSlide();
        lastSlide.background = { path: template.endImage };
        lastSlide.addText("感谢观看", {
          x: 0.5,
          y: 0.5,
          w: '90%',
          fontSize: 44,
          bold: true,
          color: '363636',
          align: 'center'
        });
        
        // 保存PPT
        await pres.writeFile('presentation.pptx');
        ElMessage.success('PPT生成成功！');
      } catch (error) {
        console.error('生成PPT时出错：', error);
        ElMessage.error('生成PPT失败，请重试！');
      }
    },

    // 从消息中提取PPT大纲
    extractOutlineFromMessages() {
      const outline = [];
      const messages = this.queryInfos.messages;
      
      // 查找最后一个助手回复
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.role === 'assistant') {
          // 分析消息内容，提取大纲
          const content = message.content;
          const lines = content.split('\n');
          
          let currentSection = null;
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            // 检测标题（以数字、减号、星号或点开头的行）
            if (/^[\d\-\*\.\•]/.test(trimmedLine)) {
              if (currentSection) {
                outline.push(currentSection);
              }
              currentSection = {
                title: trimmedLine.replace(/^[\d\-\*\.\•]+\.?\s*/, ''), // 移除序号和符号
                content: ''
              };
            } else if (currentSection && trimmedLine) {
              // 将非空行添加到当前章节的内容中
              currentSection.content += trimmedLine + '\n';
            }
          }
          
          // 添加最后一个章节
          if (currentSection) {
            outline.push(currentSection);
          }
          
          break;
        }
      }
      
      // 如果没有找到大纲，创建一个默认的
      if (outline.length === 0) {
        outline.push({
          title: '演示文稿',
          content: '请先生成PPT大纲'
        });
      }
      
      return outline;
    },
    // 处理阅读分析请求
    handleAnalyzeRequest(data) {
      // 查询当前是否存在对话窗口，不存在的话，新建一个对话窗口
      if (!this.sessionList.length) {
        this.handleAddSession();
      }

      // 提取显示提示和AI提示
      const { displayPrompt, aiPrompt } = data;

      // 向对话窗口添加对话信息(请求) - 只显示简短的提示
      this.queryInfos.messages.push({
        role: "user",
        content: displayPrompt,
      });
      
      // 滚动到底部
      this.forceScrollToBottom();

      try {
        // 请求服务进行提问 - 使用完整的AI提示（包含文件内容）
        this.loading = true;
        // 开始新回答时重置自动滚动
        this.$refs.messageRef.isAutoScroll = true;
        
        // 使用修改后的handleRequest方法
        this.handleRequest(aiPrompt);
      } catch (error) {
        console.error('分析请求失败:', error);
        this.loading = false;
        this.queryInfos.messages.push({
          role: "assistant",
          content: "分析失败，请稍后重试!",
        });
      }
    },
    
    // 处理图表数据分析
    handleChartDataAnalysis(data) {
      // 查询当前是否存在对话窗口，不存在的话，新建一个对话窗口
      if (!this.sessionList.length) {
        this.handleAddSession();
      }
      
      // 创建简洁的显示消息
      const displayMessage = "请对我的图表数据进行详细分析，包括统计特征、分布趋势、关键发现和洞察。";
      
      // 向对话窗口添加对话信息(请求) - 只显示简洁的提示
      this.queryInfos.messages.push({
        role: "user",
        content: displayMessage,
      });
      
      // 滚动到底部
      this.forceScrollToBottom();
      
      // 开始请求
      this.loading = true;
      this.$refs.messageRef.isAutoScroll = true;
      
      try {
        console.log("开始处理图表数据分析请求");
        
        // 检查API客户端是否初始化
        if (!this.openai) {
          console.log("重新初始化OpenAI客户端");
          this.initOpenAI();
        }
        
        // 创建一个临时的消息数组，包含历史消息和新的AI提示
        const tempMessages = [...this.queryInfos.messages];
        // 替换最后一条消息为完整的数据
        tempMessages[tempMessages.length - 1] = {
          role: "user",
          content: data,
        };
        
        console.log("发送请求到API，消息长度:", data.length);
        
        // 使用简化版的方法直接处理请求
        this.handleRequest(data);
      } catch (error) {
        console.error('图表数据分析失败:', error);
        this.loading = false;
        this.queryInfos.messages.push({
          role: "assistant",
          content: "分析失败，请稍后重试! 错误详情: " + (error.message || "未知错误"),
        });
      }
    },
  },
};
</script>

<style scoped lang="scss">
.pointer {
  cursor: pointer;
}
.inner-html-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgb(216.8, 235.6, 255);
  .page {
    width: 86vw;
    height: 90vh;
    background: #fff;
    box-shadow: 0 0 12px 12px rgb(197.7, 225.9, 255);
    box-sizing: border-box;
    border-radius: 8px;
    overflow: hidden;
    .tips {
      width: 100%;
      height: 32px;
      background: rgb(121.3, 187.1, 255);
      color: #fff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 12px;
      box-sizing: border-box;
      
      .right-section {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .title {
        font-size: 16px;
      }
      
      .desc {
        font-size: 14px;
        color: rgb(216.8, 235.6, 255);
      }
    }
    .grid-box {
      display: grid;
      grid-template-columns: 24% auto;
      column-gap: 12px;
    }
    .grid-space-between {
      width: 100%;
      height: calc(100% - 48px);
      .left-container {
        background-color: #f7f8fa;
        padding: 12px;
        height: calc(90vh - 32px - 24px); // 顶部比标题、padding边框
        // 对话列表的展示区域
        .session-area {
          width: 100%;
          height: calc(90vh - 32px - 24px - 12px - 32px); // 边框+按钮
          margin-top: 12px;
          box-sizing: border-box;
          overflow-y: auto;
          .session-item {
            height: 36px;
            line-height: 36px;
            margin-bottom: 8px;
            border-radius: 4px;
            padding: 0 18px;
            background: rgb(199.5, 201, 204);
            color: #f4f5f5;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            .normal-node {
              padding-left: 14px;
            }
            .icon-box {
              visibility: hidden;
              display: grid;
              column-gap: 8px;
              grid-template-columns: repeat(2, 1fr);
              .icon {
                cursor: pointer;
              }
            }
            &:hover .icon-box {
              visibility: visible;
            }
          }
          .session-item-active {
            background: rgb(51.2, 126.4, 204);
            color: #f4f5f5;
            .active-node {
              display: flex;
              align-items: center;
              &::before {
                display: inline-block;
                content: "";
                width: 6px;
                height: 6px;
                background: #fff;
                border-radius: 50%;
                margin-right: 8px;
              }
            }
          }
        }
      }
      .container {
        width: 100%;
        height: calc(90vh - 32px);
        background: #fff;
        border-radius: 8px;
        .message-area {
          height: calc(100% - 40px - 16px - 44px);
          width: calc(100% - 32px);
          padding: 16px 16px 0 16px;
        }
        .user-tokens {
          padding: 0 8px 0 0;
          font-size: 14px;
          color: #c7c8ca;
          user-select: none;
          margin-bottom: 5px;
          
          .tokens-row {
            height: 30px;
            line-height: 30px;
            display: flex;
            align-items: center;
            gap: 15px;
          }
          
          .buttons-container {
            display: flex;
            gap: 5px; /* 按钮之间的间距 */
          }
        }
        // 手机端留左侧边框
        .left-space {
          margin-left: 16px;
        }
        .input-area {
          height: 40px;
          display: grid;
          grid-template-columns: auto 90px;
          box-sizing: border-box;
          background: #fff;
          padding: 0 16px 16px 0;
        }
      }
    }
  }
}
:deep(.el-dialog__body) {
  overflow-y: auto;
  padding: 0;
  height: 70vh;
}
</style>
