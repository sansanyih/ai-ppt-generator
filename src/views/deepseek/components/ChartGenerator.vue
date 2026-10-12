<template>
  <div class="chart-generator">
    <el-button 
      type="primary" 
      size="small" 
      @click="showUploadDialog"
    >
      生成图表
    </el-button>

    <el-dialog
      v-model="dialogVisible"
      title="上传数据生成图表"
      width="500px"
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
          :accept="'.txt,.csv'"
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">
            拖拽文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持上传TXT或CSV文件，数据格式为每行一个数据点，逗号分隔的值
            </div>
          </template>
        </el-upload>

        <div class="selected-file" v-if="selectedFile">
          <div>已选择: {{ selectedFile.name }}</div>
          <div class="file-size">{{ formatFileSize(selectedFile.size) }}</div>
        </div>

        <div class="chart-options" v-if="selectedFile">
          <div class="option-title">图表类型</div>
          <el-radio-group v-model="chartType">
            <el-radio label="bar">柱状图</el-radio>
            <el-radio label="line">折线图</el-radio>
            <el-radio label="pie">饼图</el-radio>
            <el-radio label="scatter">散点图</el-radio>
            <el-radio label="radar">雷达图</el-radio>
          </el-radio-group>
          
          <div class="option-title" style="margin-top: 15px;">图表主题</div>
          <el-select v-model="chartTheme" placeholder="选择主题" style="width: 100%;">
            <el-option label="默认" value="default"></el-option>
            <el-option label="暗色系" value="dark"></el-option>
            <el-option label="浅蓝色系" value="light-blue"></el-option>
            <el-option label="清新绿色系" value="green"></el-option>
            <el-option label="商务风格" value="business"></el-option>
          </el-select>
        </div>

        <div class="data-preview" v-if="previewData.length > 0">
          <div class="option-title">数据预览</div>
          <el-table :data="previewData" style="width: 100%" size="small" max-height="200px">
            <el-table-column v-for="(col, index) in previewColumns" :key="index" :prop="col.prop" :label="col.label"></el-table-column>
          </el-table>
        </div>

        <div class="upload-actions">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            @click="generateChart" 
            :disabled="!selectedFile || generating"
            :loading="generating"
          >
            生成图表
          </el-button>
        </div>
      </div>
    </el-dialog>
    
    <el-dialog
      v-model="chartDialogVisible"
      title="数据图表"
      width="80%"
      :close-on-click-modal="false"
      :destroy-on-close="true"
    >
      <div class="chart-container" v-loading="generating">
        <div ref="chartRef" class="chart"></div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="chartDialogVisible = false">关闭</el-button>
          <el-button 
            type="success" 
            @click="analyzeChartData" 
            :loading="analyzing"
          >
            进行数据分析
          </el-button>
          <el-button 
            type="primary" 
            @click="exportToPDF" 
            :loading="exporting"
          >
            导出PDF
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { UploadFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { ref, onMounted, nextTick, computed } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart, RadarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  ToolboxComponent,
  VisualMapComponent
} from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import OpenAI from "openai";

// 注册必需的组件
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  ToolboxComponent,
  VisualMapComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  RadarChart
]);

// 定义图表主题
const chartThemes = {
  'dark': {
    backgroundColor: '#2c343c',
    textColor: '#fff',
    titleColor: '#fff',
    legendColor: '#fff',
    color: ['#dd6b66', '#759aa0', '#e69d87', '#8dc1a9', '#ea7e53', '#eedd78', '#73a373', '#73b9bc']
  },
  'light-blue': {
    backgroundColor: '#f2f9ff',
    textColor: '#333',
    titleColor: '#2c73d2',
    legendColor: '#2c73d2',
    color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4']
  },
  'green': {
    backgroundColor: '#f5fffa',
    textColor: '#333',
    titleColor: '#4ca97e',
    legendColor: '#444',
    color: ['#44bba4', '#a6e1e0', '#e8ffc1', '#19535f', '#7eb2dd', '#c9a690', '#d5f2e3', '#89b0ae']
  },
  'business': {
    backgroundColor: '#fff',
    textColor: '#333',
    titleColor: '#333',
    legendColor: '#666',
    color: ['#5b9bd5', '#ed7d31', '#70ad47', '#ffc000', '#4472c4', '#a5a5a5', '#9e480e', '#997300']
  }
};

export default {
  name: 'ChartGenerator',
  components: {
    UploadFilled
  },
  emits: ['send-to-chat'],
  setup(props, { emit }) {
    const dialogVisible = ref(false);
    const chartDialogVisible = ref(false);
    const selectedFile = ref(null);
    const generating = ref(false);
    const exporting = ref(false);
    const analyzing = ref(false);
    const chartType = ref('bar');
    const chartTheme = ref('default');
    const chartRef = ref(null);
    let chartInstance = null;
    let chartData = null;
    
    const previewData = ref([]);
    const previewColumns = ref([]);
    
    const showUploadDialog = () => {
      dialogVisible.value = true;
      selectedFile.value = null;
      previewData.value = [];
      previewColumns.value = [];
    };
    
    const handleFileChange = (file) => {
      selectedFile.value = file.raw;
      
      // 自动解析并预览数据
      if (file.raw) {
        readFileContent(file.raw)
          .then(content => {
            try {
              // 解析数据并生成预览
              const result = parseData(content, true); // 传入true表示仅预览
              
              // 设置预览数据
              if (result && result.previewData && result.previewData.length > 0) {
                previewData.value = result.previewData.slice(0, 5); // 最多显示5行预览
                
                // 设置列信息
                const firstRow = result.previewData[0];
                const columns = Object.keys(firstRow).map(key => ({
                  prop: key,
                  label: key
                }));
                
                previewColumns.value = columns;
              }
            } catch (error) {
              console.warn('数据预览解析失败:', error);
              // 预览失败不显示错误，等到用户点击生成按钮时再提示
            }
          })
          .catch(error => {
            console.warn('文件读取失败:', error);
          });
      }
    };
    
    const formatFileSize = (size) => {
      if (size < 1024) {
        return size + ' B';
      } else if (size < 1024 * 1024) {
        return (size / 1024).toFixed(2) + ' KB';
      } else {
        return (size / (1024 * 1024)).toFixed(2) + ' MB';
      }
    };
    
    const readFileContent = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target.result);
        };
        reader.onerror = (e) => {
          reject(new Error('文件读取失败'));
        };
        reader.readAsText(file);
      });
    };
    
    const parseData = (content, isPreview = false) => {
      try {
        // 按行分割
        const lines = content.trim().split('\n');
        
        // 检查是否是CSV格式
        const isCSV = lines[0].includes(',');
        const isTabSeparated = !isCSV && lines[0].includes('\t');
        
        let delimiter = isCSV ? ',' : (isTabSeparated ? '\t' : ':');
        
        // 检测分隔符
        if (!isCSV && !isTabSeparated) {
          // 尝试检测使用的分隔符
          const firstLine = lines[0];
          const possibleDelimiters = [',', '\t', ';', '|', ':'];
          for (const del of possibleDelimiters) {
            if (firstLine.includes(del)) {
              delimiter = del;
              break;
            }
          }
        }
        
        // 解析头部和数据
        const headers = lines[0].split(delimiter).map(h => h.trim());
        const rawData = [];
        const categories = [];
        const series = {};
        
        // 初始化数据系列
        for (let i = 1; i < headers.length; i++) {
          series[headers[i] || `数据${i}`] = [];
        }
        
        // 准备预览数据
        const previewData = [];
        
        // 处理每一行数据
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue; // 跳过空行
          
          const values = lines[i].split(delimiter).map(v => v.trim());
          if (values.length >= 2) {
            // 添加类别
            categories.push(values[0]);
            
            // 处理每个系列的数据
            const rowData = { category: values[0] };
            
            for (let j = 1; j < values.length && j < headers.length; j++) {
              const seriesName = headers[j] || `数据${j}`;
              const value = isNaN(parseFloat(values[j])) ? 0 : parseFloat(values[j]);
              
              // 确保series[seriesName]是一个数组
              if (!Array.isArray(series[seriesName])) {
                series[seriesName] = [];
              }
              
              series[seriesName].push(value);
              rowData[seriesName] = value;
            }
            
            rawData.push(values);
            if (previewData.length < 10) {
              previewData.push(rowData);
            }
          }
        }
        
        // 如果只是预览，返回预览数据
        if (isPreview) {
          return {
            previewData,
            headers
          };
        }
        
        // 为简单的图表类型准备数据
        if (chartType.value === 'bar' || chartType.value === 'line') {
          // 多系列数据
          const seriesData = [];
          
          Object.keys(series).forEach(name => {
            seriesData.push({
              name,
              type: chartType.value,
              data: series[name],
              smooth: chartType.value === 'line'
            });
          });
          
          return {
            categories,
            series: seriesData,
            title: '数据图表',
            rawData,
            previewData,
            headers
          };
        } else if (chartType.value === 'pie') {
          // 饼图数据 - 只使用第一个数据系列
          const seriesNames = Object.keys(series);
          if (seriesNames.length === 0) {
            throw new Error('没有发现有效的数据系列');
          }
          
          const firstSeriesName = seriesNames[0];
          const pieData = categories.map((category, index) => ({
            name: category,
            value: series[firstSeriesName][index] || 0
          }));
          
          return {
            categories,
            pieData,
            title: firstSeriesName || '数据分布',
            rawData,
            previewData,
            headers
          };
        } else if (chartType.value === 'scatter') {
          // 散点图数据 - 使用前两个数据系列作为X和Y
          const seriesNames = Object.keys(series);
          if (seriesNames.length < 2) {
            throw new Error('散点图需要至少两个数据列');
          }
          
          const scatterData = [];
          const xSeries = series[seriesNames[0]] || [];
          const ySeries = series[seriesNames[1]] || [];
          
          const minLength = Math.min(xSeries.length, ySeries.length);
          for (let i = 0; i < minLength; i++) {
            scatterData.push([xSeries[i] || 0, ySeries[i] || 0]);
          }
          
          return {
            scatterData,
            xName: seriesNames[0],
            yName: seriesNames[1],
            title: `${seriesNames[0]} vs ${seriesNames[1]}`,
            rawData,
            previewData,
            headers
          };
        } else if (chartType.value === 'radar') {
          // 雷达图数据
          const seriesNames = Object.keys(series);
          if (seriesNames.length === 0 || categories.length === 0) {
            throw new Error('雷达图需要有效的类别和数据系列');
          }
          
          const indicator = categories.map((category, index) => {
            // 计算每个维度的最大值
            let max = 0;
            seriesNames.forEach(seriesName => {
              const value = series[seriesName][index] || 0;
              if (value > max) {
                max = value;
              }
            });
            
            return {
              name: category,
              max: Math.ceil(max * 1.2) // 最大值设为数据最大值的1.2倍，至少为10
            };
          });
          
          const radarData = [];
          seriesNames.forEach(name => {
            // 确保数据长度与类别数量匹配
            const values = [];
            for (let i = 0; i < categories.length; i++) {
              values.push(series[name][i] || 0);
            }
            
            radarData.push({
              name,
              value: values,
              areaStyle: {
                opacity: 0.3
              }
            });
          });
          
          return {
            indicator,
            radarData,
            title: '数据雷达图',
            rawData,
            previewData,
            headers
          };
        }
        
      } catch (error) {
        console.error('数据解析错误:', error);
        throw new Error('数据格式不正确，请检查文件内容: ' + error.message);
      }
    };
    
    const generateChart = async () => {
      if (!selectedFile.value) {
        ElMessage.warning('请先选择文件');
        return;
      }
      
      generating.value = true;
      
      try {
        // 读取文件内容
        const content = await readFileContent(selectedFile.value);
        
        // 解析数据
        const parsedData = parseData(content);
        chartData = parsedData; // 保存数据以供导出使用
        
        // 关闭上传对话框，打开图表对话框
        dialogVisible.value = false;
        chartDialogVisible.value = true;
        
        // 等待DOM更新
        await nextTick();
        
        // 初始化图表
        initChart(parsedData);
        
      } catch (error) {
        console.error('图表生成失败:', error);
        ElMessage.error(error.message || '图表生成失败，请重试');
      } finally {
        generating.value = false;
      }
    };
    
    const initChart = (data) => {
      if (!chartRef.value) return;
      
      // 如果已有图表实例，销毁它
      if (chartInstance) {
        chartInstance.dispose();
      }
      
      // 创建新的图表实例
      chartInstance = echarts.init(chartRef.value);
      
      // 应用主题
      if (chartTheme.value !== 'default') {
        const theme = chartThemes[chartTheme.value];
        if (theme) {
          chartInstance.setOption({
            backgroundColor: theme.backgroundColor,
            textStyle: {
              color: theme.textColor
            },
            title: {
              textStyle: {
                color: theme.titleColor
              }
            },
            legend: {
              textStyle: {
                color: theme.legendColor
              }
            },
            color: theme.color
          });
        }
      }
      
      // 根据图表类型设置配置
      let option;
      
      switch (chartType.value) {
        case 'bar':
          option = {
            title: {
              text: data.title
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'shadow'
              }
            },
            legend: {
              data: data.series.map(item => item.name)
            },
            toolbox: {
              show: true,
              feature: {
                dataZoom: {
                  yAxisIndex: 'none'
                },
                dataView: { readOnly: false },
                magicType: { type: ['line', 'bar'] },
                restore: {},
                saveAsImage: {}
              }
            },
            xAxis: {
              type: 'category',
              data: data.categories,
              axisLabel: {
                interval: 0,
                rotate: data.categories.length > 8 ? 45 : 0
              }
            },
            yAxis: {
              type: 'value'
            },
            series: data.series
          };
          break;
        case 'line':
          option = {
            title: {
              text: data.title
            },
            tooltip: {
              trigger: 'axis'
            },
            legend: {
              data: data.series.map(item => item.name)
            },
            toolbox: {
              show: true,
              feature: {
                dataZoom: {
                  yAxisIndex: 'none'
                },
                dataView: { readOnly: false },
                magicType: { type: ['line', 'bar'] },
                restore: {},
                saveAsImage: {}
              }
            },
            xAxis: {
              type: 'category',
              data: data.categories,
              axisLabel: {
                interval: 0,
                rotate: data.categories.length > 8 ? 45 : 0
              }
            },
            yAxis: {
              type: 'value'
            },
            series: data.series
          };
          break;
        case 'pie':
          option = {
            title: {
              text: data.title,
              left: 'center'
            },
            tooltip: {
              trigger: 'item',
              formatter: '{a} <br/>{b}: {c} ({d}%)'
            },
            legend: {
              orient: 'vertical',
              left: 'left',
              data: data.categories
            },
            toolbox: {
              show: true,
              feature: {
                dataView: { readOnly: false },
                restore: {},
                saveAsImage: {}
              }
            },
            series: [
              {
                name: data.title,
                type: 'pie',
                radius: '55%',
                center: ['50%', '60%'],
                data: data.pieData,
                emphasis: {
                  itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                  }
                },
                label: {
                  formatter: '{b}: {d}%'
                }
              }
            ]
          };
          break;
        case 'scatter':
          option = {
            title: {
              text: data.title
            },
            tooltip: {
              trigger: 'item',
              formatter: function(params) {
                return `${data.xName}: ${params.value[0]}<br/>${data.yName}: ${params.value[1]}`;
              }
            },
            toolbox: {
              show: true,
              feature: {
                dataZoom: {},
                dataView: { readOnly: false },
                restore: {},
                saveAsImage: {}
              }
            },
            xAxis: {
              type: 'value',
              name: data.xName,
              nameLocation: 'middle',
              nameGap: 30
            },
            yAxis: {
              type: 'value',
              name: data.yName,
              nameLocation: 'middle',
              nameGap: 30
            },
            visualMap: {
              min: 0,
              max: 100,
              dimension: 1,
              orient: 'vertical',
              right: 0,
              top: 'center',
              calculable: true,
              inRange: {
                color: ['#f2c31a', '#24b7f2']
              },
              show: false
            },
            series: [
              {
                name: data.title,
                type: 'scatter',
                symbolSize: 12,
                data: data.scatterData
              }
            ]
          };
          break;
        case 'radar':
          option = {
            title: {
              text: data.title
            },
            tooltip: {
              trigger: 'item'
            },
            legend: {
              data: data.radarData.map(item => item.name)
            },
            radar: {
              indicator: data.indicator
            },
            series: [
              {
                type: 'radar',
                data: data.radarData
              }
            ]
          };
          break;
      }
      
      // 设置图表配置
      chartInstance.setOption(option);
      
      // 响应窗口大小变化
      window.addEventListener('resize', () => {
        if (chartInstance) {
          chartInstance.resize();
        }
      });
    };
    
    // 将图表数据转换为文本格式
    const convertChartDataToText = () => {
      if (!chartData) {
        return '没有可分析的数据';
      }
      
      let textData = '';
      
      // 添加图表标题和类型
      textData += `图表标题: ${chartData.title || '数据图表'}\n`;
      textData += `图表类型: ${chartType.value === 'bar' ? '柱状图' : 
                   chartType.value === 'line' ? '折线图' : 
                   chartType.value === 'pie' ? '饼图' : 
                   chartType.value === 'scatter' ? '散点图' : 
                   chartType.value === 'radar' ? '雷达图' : '未知类型'}\n\n`;
      
      // 根据图表类型格式化数据
      if (chartType.value === 'bar' || chartType.value === 'line') {
        // 添加类别/X轴数据
        textData += `类别/X轴数据: ${chartData.categories.join(', ')}\n\n`;
        
        // 添加每个系列的数据
        textData += '数据系列:\n';
        chartData.series.forEach(series => {
          textData += `${series.name}: ${series.data.join(', ')}\n`;
        });
      } else if (chartType.value === 'pie') {
        // 添加饼图数据
        textData += '饼图数据:\n';
        chartData.pieData.forEach(item => {
          textData += `${item.name}: ${item.value}\n`;
        });
      } else if (chartType.value === 'scatter') {
        // 添加散点图数据
        textData += `X轴名称: ${chartData.xName || 'X轴'}\n`;
        textData += `Y轴名称: ${chartData.yName || 'Y轴'}\n\n`;
        textData += '散点数据 (X, Y):\n';
        chartData.scatterData.forEach(point => {
          textData += `(${point[0]}, ${point[1]})\n`;
        });
      } else if (chartType.value === 'radar') {
        // 添加雷达图维度
        textData += '雷达图维度:\n';
        chartData.indicator.forEach(ind => {
          textData += `${ind.name} (最大值: ${ind.max})\n`;
        });
        
        textData += '\n雷达图数据:\n';
        chartData.radarData.forEach(series => {
          textData += `${series.name}: ${series.value.join(', ')}\n`;
        });
      }
      
      // 添加原始数据表格
      if (chartData.rawData && chartData.rawData.length > 0) {
        textData += '\n原始数据表格:\n';
        
        // 添加表头
        if (chartData.headers && chartData.headers.length > 0) {
          textData += chartData.headers.join('\t') + '\n';
        }
        
        // 添加数据行
        chartData.rawData.forEach(row => {
          textData += row.join('\t') + '\n';
        });
      }
      
      return textData;
    };
    
    // 分析图表数据
    const analyzeChartData = async () => {
      if (!chartData) {
        ElMessage.warning('没有可分析的数据');
        return;
      }
      
      analyzing.value = true;
      
      try {
        // 将图表数据转换为文本
        const textData = convertChartDataToText();
        
        // 准备发送的提示语
        const prompt = `请对以下数据图表信息进行详细分析，包括但不限于：
1. 数据的基本统计特征（平均值、中位数、最大值、最小值等）
2. 数据的分布特征和趋势
3. 数据中的关键发现和洞察
4. 可能的异常值和特殊模式
5. 对数据背后可能原因的推测和建议

数据信息如下：
${textData}`;

        // 发送事件到父组件，将数据发送到聊天界面
        emit('send-to-chat', prompt);
        
        // 关闭图表对话框
        chartDialogVisible.value = false;
        
        ElMessage.success('正在进行数据分析');
      } catch (error) {
        console.error('数据分析请求失败:', error);
        ElMessage.error('数据分析请求失败: ' + error.message);
      } finally {
        analyzing.value = false;
      }
    };
    
    // 修改exportToPDF函数，添加AI分析结果到PDF
    const exportToPDF = async () => {
      if (!chartRef.value || !chartInstance) {
        ElMessage.warning('没有可导出的图表');
        return;
      }
      
      exporting.value = true;
      
      try {
        // 创建PDF文档
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4'
        });
        
        // 添加标题
        const title = chartData ? chartData.title : '数据图表';
        
        // 使用更安全的方式添加文本，避免乱码
        pdf.setFont('helvetica');
        pdf.setFontSize(18);
        pdf.text(title, 20, 20);
        
        // 添加生成时间
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        pdf.setFontSize(10);
        pdf.text(`生成时间: ${dateStr}`, 20, 30);
        
        // 直接从ECharts获取图表图像，而不是使用html2canvas
        const base64 = chartInstance.getDataURL({
          type: 'png',
          pixelRatio: 2, // 高分辨率
          backgroundColor: '#fff'
        });
        
        // 将图像添加到PDF
        const imgWidth = 250; // PDF宽度减去边距
        const imgHeight = 120; // 保持合适的高宽比
        
        pdf.addImage(base64, 'PNG', 20, 40, imgWidth, imgHeight);
        
        // 如果有数据表格，添加到PDF
        if (chartData && chartData.rawData && chartData.rawData.length > 0) {
          // 添加表格标题
          pdf.addPage();
          pdf.setFontSize(16);
          pdf.text('数据表格', 20, 20);
          
          try {
            // 创建表格
            const tableData = [];
            
            // 准备表头
            let headerRow = [];
            if (chartData.headers && chartData.headers.length > 0) {
              headerRow = [...chartData.headers]; // 复制headers
            } else if (chartData.rawData[0] && chartData.rawData[0].length > 0) {
              // 如果没有headers，创建默认headers
              headerRow = [`类别`];
              for (let i = 1; i < chartData.rawData[0].length; i++) {
                headerRow.push(`数据${i}`);
              }
            } else {
              headerRow = ['类别', '数值'];
            }
            
            tableData.push(headerRow);
            
            // 添加数据行
            for (let i = 0; i < chartData.rawData.length; i++) {
              const row = chartData.rawData[i];
              if (Array.isArray(row) && row.length > 0) {
                // 确保所有单元格都是字符串
                const formattedRow = row.map(cell => 
                  String(cell !== undefined && cell !== null ? cell : '').substring(0, 30)
                );
                tableData.push(formattedRow);
              }
            }
            
            // 计算表格位置和大小
            const startY = 30;
            const cellWidth = 40; // 减小单元格宽度以容纳更多列
            const cellHeight = 10;
            
            // 调整表格宽度以适应页面
            const maxColumns = Math.min(tableData[0].length, Math.floor(257 / cellWidth));
            
            // 绘制表格
            pdf.setFontSize(10); // 减小字体大小
            pdf.setDrawColor(0, 0, 0);
            pdf.setTextColor(0, 0, 0);
            
            // 绘制表头
            pdf.setFillColor(240, 240, 240);
            pdf.rect(20, startY, cellWidth * maxColumns, cellHeight, 'F');
            pdf.setFont('helvetica', 'bold');
            
            for (let i = 0; i < maxColumns; i++) {
              const text = tableData[0][i] || '';
              // 截断文本以适应单元格
              const displayText = text.length > 10 ? text.substring(0, 8) + '..' : text;
              pdf.text(displayText, 22 + i * cellWidth, startY + 7);
            }
            
            // 绘制数据行
            pdf.setFont('helvetica', 'normal');
            const maxRows = Math.min(tableData.length, 30); // 限制最多30行
            
            for (let i = 1; i < maxRows; i++) {
              const row = tableData[i] || [];
              const y = startY + i * cellHeight;
              
              // 交替行背景色
              if (i % 2 === 0) {
                pdf.setFillColor(250, 250, 250);
                pdf.rect(20, y, cellWidth * maxColumns, cellHeight, 'F');
              }
              
              // 绘制每个单元格的边框和内容
              for (let j = 0; j < maxColumns; j++) {
                // 绘制单元格边框
                pdf.rect(20 + j * cellWidth, y, cellWidth, cellHeight, 'S');
                
                // 填充单元格内容
                const text = row[j] || '';
                // 截断文本以适应单元格
                const displayText = text.length > 10 ? text.substring(0, 8) + '..' : text;
                pdf.text(displayText, 22 + j * cellWidth, y + 7);
              }
            }
            
            // 如果数据超过30行，添加提示
            if (tableData.length > 30) {
              pdf.text(`(显示前${maxRows-1}行，共${tableData.length-1}行数据)`, 20, startY + maxRows * cellHeight + 10);
            }
            
            // 如果列数超过最大显示列数，添加提示
            if (tableData[0].length > maxColumns) {
              pdf.text(`(显示前${maxColumns}列，共${tableData[0].length}列数据)`, 20, startY + maxRows * cellHeight + 20);
            }
          } catch (tableError) {
            console.error('表格绘制错误:', tableError);
            pdf.text('无法绘制数据表格: ' + tableError.message, 20, 50);
          }
        }
        
        // 保存PDF
        const safeTitle = title.replace(/[^\w\s-]/g, '_').replace(/\s+/g, '_');
        pdf.save(`${safeTitle}_${now.getTime()}.pdf`);
        
        ElMessage.success('PDF导出成功');
      } catch (error) {
        console.error('PDF导出失败:', error);
        ElMessage.error('PDF导出失败，请重试');
      } finally {
        exporting.value = false;
      }
    };
    
    // 组件卸载时清理图表实例
    onMounted(() => {
      return () => {
        if (chartInstance) {
          chartInstance.dispose();
        }
      };
    });
    
    return {
      dialogVisible,
      chartDialogVisible,
      selectedFile,
      generating,
      exporting,
      analyzing,
      chartType,
      chartTheme,
      chartRef,
      showUploadDialog,
      handleFileChange,
      formatFileSize,
      generateChart,
      analyzeChartData,
      exportToPDF,
      previewData,
      previewColumns
    };
  }
};
</script>

<style scoped lang="scss">
.chart-generator {
  margin-left: 5px;
}

.upload-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
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

.chart-options {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 15px;
  margin-top: 10px;
  
  .option-title {
    font-weight: bold;
    margin-bottom: 10px;
    color: #606266;
  }
}

.data-preview {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 15px;
  margin-top: 15px;
  
  .option-title {
    font-weight: bold;
    margin-bottom: 10px;
    color: #606266;
  }
}

.analysis-container {
  margin-top: 20px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 15px;
}

.analysis-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 15px;
  color: #409EFF;
}

.analysis-content-text {
  line-height: 1.6;
  color: #333;
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.chart-container {
  width: 100%;
  height: 500px;
  
  .chart {
    width: 100%;
    height: 100%;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style> 