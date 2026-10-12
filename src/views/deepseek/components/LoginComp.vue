<template>
  <div class="login-container">
    <div class="login-box">
      <h2>登录</h2>
      <el-form :model="loginForm" :rules="rules" ref="loginFormRef">
        <el-form-item prop="username">
          <el-input 
            v-model="loginForm.username" 
            placeholder="请输入用户名"
            prefix-icon="User"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input 
            v-model="loginForm.password" 
            type="password" 
            placeholder="请输入密码"
            prefix-icon="Lock"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button 
            type="primary" 
            style="width: 100%"
            :loading="loading"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script>
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

export default {
  name: 'LoginComp',
  components: {
    User,
    Lock
  },
  data() {
    return {
      loading: false,
      loginForm: {
        username: '',
        password: ''
      },
      rules: {
        username: [
          { required: true, message: '请输入用户名', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '请输入密码', trigger: 'blur' }
        ]
      }
    }
  },
  methods: {
    handleLogin() {
      this.$refs.loginFormRef.validate((valid) => {
        if (!valid) return;
        
        this.loading = true;
        
        // 验证账号密码
        if (this.loginForm.username === 'wangxiaoming' && 
            this.loginForm.password === '123456') {
          // 登录成功
          localStorage.setItem('isLoggedIn', 'true');
          this.$emit('login-success');
          ElMessage.success('登录成功');
        } else {
          ElMessage.error('用户名或密码错误');
        }
        
        this.loading = false;
      });
    }
  }
}
</script>

<style scoped lang="scss">
.login-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgb(216.8, 235.6, 255);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;

  .login-box {
    width: 400px;
    padding: 40px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 0 12px 12px rgb(197.7, 225.9, 255);

    h2 {
      text-align: center;
      margin-bottom: 30px;
      color: #409EFF;
    }

    :deep(.el-input) {
      margin-bottom: 10px;
    }
  }
}
</style> 