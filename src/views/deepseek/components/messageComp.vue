<template>
  <div class="container-message" id="messageCompBox" @scroll="handleScroll">
    <!-- 新增滚动到底部按钮 -->
    <div
        v-if="showScrollToBottom"
        class="scroll-to-bottom"
        @click="scrollBottom(true)"
    >
      <el-icon :size="20"><ArrowDownBold /></el-icon>
    </div>
    <template v-if="message.length">
      <div
          class="box-item"
          v-for="(item, index) in message"
          :key="`message_${index}`"
      >
        <div class="message-item-assistant" v-if="item.role == 'assistant'">
          <el-avatar class="icon">
            <img src="../images/ai.png" />
          </el-avatar>
          <div class="texts left">
            <div class="text-left">
              <Markdown :source="item.content" />
            </div>
          </div>
          <div></div>
        </div>
        <div class="message-item-custom" v-else>
          <div></div>
          <div class="texts right">
            <div class="text-right">
              <Markdown :source="item.content" />
            </div>
          </div>
          <el-avatar class="icon">
            <img src="../images/user.png" />
          </el-avatar>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="empty-box">
        <el-empty description="暂无对话信息"></el-empty>
      </div>
    </template>
  </div>
</template>

<script>
import Markdown from "vue3-markdown-it";
import { ArrowDownBold } from "@element-plus/icons-vue";
export default {
  components: { Markdown, ArrowDownBold },
  props: {
    message: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      isAutoScroll: true, // 新增自动滚动标志位
      lastScrollPos: 0,   // 新增最后滚动位置
      showScrollToBottom: false, // 新增显示控制状态
    };
  },
  methods: {
    handleScroll() {
      const container = document.getElementById("messageCompBox");
      const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 5;

      // 新增：只有内容超过容器高度时才判断
      const hasScroll = container.scrollHeight > container.clientHeight;

      this.showScrollToBottom = hasScroll && !isNearBottom;

      // 原有滚动处理逻辑保持不变
      if (!isNearBottom && container.scrollTop !== this.lastScrollPos) {
        this.isAutoScroll = false;
      }
      if (isNearBottom) {
        this.isAutoScroll = true;
      }
      this.lastScrollPos = container.scrollTop;
    },
    scrollBottom(isForce) {
      if (isForce || this.isAutoScroll) { // 只在允许时滚动
        this.$nextTick(() => {
          const div = document.getElementById("messageCompBox");
          div.scrollTop = div.scrollHeight - div.clientHeight;
          this.showScrollToBottom = false; // 滚动后隐藏按钮
        });
      }
    },
  },
};
</script>

<style scoped lang="scss">
.container-message {
  width: 100%;
  height: 100%;
  overflow: auto;
  .scroll-to-bottom {
    position: absolute;
    left: 50%;
    bottom: 120px;
    width: 36px;
    height: 36px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity 0.3s;
    z-index: 1000;

    &:hover {
      background: rgba(0, 0, 0, 0.8);
    }

    .el-icon {
      color: #fff;
    }
  }
  .empty-box {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    .el-empty {
    }
  }

  .box-item {
    margin-bottom: 18px;
    // user
    .message-item-custom {
      display: grid;
      grid-template-columns: 18% auto 40px;
      justify-content: end;
      column-gap: 12px;
      .icon {
        width: 40px;
        height: 40px;
        background-color: #fff;
        border: 2px solid #1296db;
        padding: 6px;
      }
      .texts {
        .text-right {
          padding: 0 16px;
          color: #fff;
          position: relative;
        }
      }
    }
    // assistant
    .message-item-assistant {
      display: grid;
      grid-template-columns: 40px auto 18%;
      justify-content: start;
      column-gap: 12px;
      .icon {
        width: 40px;
        height: 40px;
        background-color: #fff;
        border: 2px solid #1296db;
        padding: 4px;
      }
      .texts {
        .text-left {
          padding: 0 16px;
          color: #fff;
          position: relative;
        }
      }
    }
  }
}

.left,
.right {
  background-color: #07c160;
  position: relative;
  border-radius: 8px;
}
.left::before {
  content: "";
  width: 0;
  height: 0;
  position: absolute;
  border: 5px solid transparent;
  border-right-color: #07c160;
  left: -9px;
  top: 15px;
}
.right::before {
  content: "";
  width: 0;
  height: 0;
  position: absolute;
  border: 5px solid transparent;
  border-left-color: #07c160;
  right: -9px;
  top: 15px;
}
</style>
