// ==================== 数据结构 ====================
let students = [];
let rollState = {
    mode: 'random',
    currentIndex: 0,
    remainingSet: new Set(),
    started: false,
    currentStudent: null,
    isAnimating: false,
    animationTimer: null
};
let records = [];

// ==================== 存储模块 ====================
const Storage = {
    KEYS: {
        STUDENTS: 'rollcall_students',
        RECORDS: 'rollcall_records'
    },

    loadStudents() {
        try {
            const data = localStorage.getItem(this.KEYS.STUDENTS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('加载学生名单失败:', e);
            return [];
        }
    },

    saveStudents(students) {
        try {
            localStorage.setItem(this.KEYS.STUDENTS, JSON.stringify(students));
        } catch (e) {
            console.error('保存学生名单失败:', e);
        }
    },

    loadRecords() {
        try {
            const data = localStorage.getItem(this.KEYS.RECORDS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('加载记录失败:', e);
            return [];
        }
    },

    saveRecords(records) {
        try {
            localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
        } catch (e) {
            console.error('保存记录失败:', e);
        }
    },

    clearRecords() {
        try {
            localStorage.removeItem(this.KEYS.RECORDS);
        } catch (e) {
            console.error('清除记录失败:', e);
        }
    }
};

// ==================== CSV 模块 ====================
const CSV = {
    parse(text) {
        // 移除 BOM
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1);
        }

        // 分割行，支持 \n 和 \r\n
        const lines = text.split(/\r?\n/);
        const names = [];

        lines.forEach((line, index) => {
            // 去除首尾空格
            const trimmed = line.trim();

            // 跳过空行
            if (!trimmed) return;

            // 如果第一行是"姓名"，跳过表头
            if (index === 0 && (trimmed === '姓名' || trimmed.toLowerCase() === 'name')) return;

            names.push(trimmed);
        });

        // 去重
        return [...new Set(names)];
    },

    export(records) {
        // UTF-8 BOM
        const BOM = '\uFEFF';

        // CSV 头部
        let csv = BOM + '日期时间,姓名,状态\n';

        // 数据行
        records.forEach(record => {
            const date = new Date(record.ts);
            const dateStr = this.formatDateTime(date);
            csv += `${dateStr},${record.name},${record.status}\n`;
        });

        return csv;
    },

    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    },

    download(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }
};

// ==================== UI 模块 ====================
const UI = {
    elements: {
        // 导入区
        csvFileInput: null,
        importBtn: null,
        importMessage: null,

        // 控制区
        totalCount: null,
        calledCount: null,
        remainingCount: null,
        modeRadios: null,
        startBtn: null,
        stopBtn: null,
        studentNameDisplay: null,
        attendBtn: null,
        lateBtn: null,
        absentBtn: null,

        // 记录管理区
        startDate: null,
        endDate: null,
        filterCount: null,
        exportBtn: null,
        clearBtn: null,

        // 展示区
        recordsList: null
    },

    init() {
        // 获取所有元素
        this.elements.csvFileInput = document.getElementById('csvFileInput');
        this.elements.importBtn = document.getElementById('importBtn');
        this.elements.importMessage = document.getElementById('importMessage');

        this.elements.totalCount = document.getElementById('totalCount');
        this.elements.calledCount = document.getElementById('calledCount');
        this.elements.remainingCount = document.getElementById('remainingCount');
        this.elements.modeRadios = document.querySelectorAll('input[name="mode"]');
        this.elements.startBtn = document.getElementById('startBtn');
        this.elements.stopBtn = document.getElementById('stopBtn');
        this.elements.studentNameDisplay = document.querySelector('.student-name');
        this.elements.attendBtn = document.getElementById('attendBtn');
        this.elements.lateBtn = document.getElementById('lateBtn');
        this.elements.absentBtn = document.getElementById('absentBtn');

        this.elements.startDate = document.getElementById('startDate');
        this.elements.endDate = document.getElementById('endDate');
        this.elements.filterCount = document.getElementById('filterCount');
        this.elements.exportBtn = document.getElementById('exportBtn');
        this.elements.clearBtn = document.getElementById('clearBtn');

        this.elements.recordsList = document.getElementById('recordsList');

        // 初始化日期选择器为今天
        const today = new Date().toISOString().split('T')[0];
        this.elements.startDate.value = today;
        this.elements.endDate.value = today;
    },

    updateStudentCount() {
        const total = students.length;
        const remaining = rollState.remainingSet.size;
        const called = total - remaining;

        this.elements.totalCount.textContent = total;
        this.elements.calledCount.textContent = called;
        this.elements.remainingCount.textContent = remaining;
    },

    updateRecordDisplay() {
        if (records.length === 0) {
            this.elements.recordsList.innerHTML = '<p class="empty-message">暂无记录</p>';
            return;
        }

        // 显示最近 20 条记录
        const recentRecords = records.slice(-20).reverse();

        const html = recentRecords.map(record => {
            const date = new Date(record.ts);
            const dateStr = CSV.formatDateTime(date);

            return `
                <div class="record-item">
                    <div class="record-info">
                        <div class="record-time">${dateStr}</div>
                        <div class="record-name">${record.name}</div>
                    </div>
                    <div class="record-status status-${record.status}">${record.status}</div>
                </div>
            `;
        }).join('');

        this.elements.recordsList.innerHTML = html;
    },

    updateButtonStates() {
        const hasStudents = students.length > 0;
        const isStarted = rollState.started;
        const isAnimating = rollState.isAnimating;

        // 开始按钮：有学生且未开始
        this.elements.startBtn.disabled = !hasStudents || isStarted;

        // 停止按钮：已开始
        this.elements.stopBtn.disabled = !isStarted;

        // 考勤按钮：已开始且不在动画中
        this.elements.attendBtn.disabled = !isStarted || isAnimating;
        this.elements.lateBtn.disabled = !isStarted || isAnimating;
        this.elements.absentBtn.disabled = !isStarted || isAnimating;

        // 模式选择：未开始时可选
        this.elements.modeRadios.forEach(radio => {
            radio.disabled = isStarted;
        });
    },

    showMessage(message, isSuccess = true) {
        this.elements.importMessage.textContent = message;
        this.elements.importMessage.className = isSuccess ? 'message success' : 'message error';

        // 3秒后清除消息
        setTimeout(() => {
            this.elements.importMessage.textContent = '';
            this.elements.importMessage.className = 'message';
        }, 3000);
    },

    updateCurrentStudent(name) {
        if (name) {
            this.elements.studentNameDisplay.textContent = name;
        } else {
            this.elements.studentNameDisplay.textContent = '';
        }
    },

    // 添加动画类
    addAnimationClass() {
        this.elements.studentNameDisplay.classList.add('animating');
    },

    // 移除动画类
    removeAnimationClass() {
        this.elements.studentNameDisplay.classList.remove('animating');
    },

    updateFilterCount() {
        const filtered = RollCall.getFilteredRecords();
        this.elements.filterCount.textContent = `共 ${filtered.length} 条记录`;
    }
};

// ==================== 点名逻辑 ====================
const RollCall = {
    startRollCall() {
        if (students.length === 0) {
            UI.showMessage('请先导入学生名单', false);
            return;
        }

        // 获取选中的模式
        const modeRadio = document.querySelector('input[name="mode"]:checked');
        rollState.mode = modeRadio.value;

        // 初始化状态
        rollState.started = true;
        rollState.currentIndex = 0;
        rollState.remainingSet = new Set(students);

        // 更新 UI
        UI.updateButtonStates();
        UI.updateStudentCount();

        // 显示第一个学生（随机模式带动画）
        if (rollState.mode === 'random') {
            this.startRandomAnimation();
        } else {
            this.nextStudent();
        }
    },

    stopRollCall() {
        // 清除动画计时器
        if (rollState.animationTimer) {
            clearInterval(rollState.animationTimer);
            rollState.animationTimer = null;
        }

        rollState.started = false;
        rollState.currentStudent = null;
        rollState.isAnimating = false;

        UI.removeAnimationClass();
        UI.updateCurrentStudent('');
        UI.updateButtonStates();
    },

    // 随机点名动画
    startRandomAnimation() {
        if (rollState.remainingSet.size === 0) {
            UI.updateCurrentStudent('已全部点名完成');
            UI.showMessage('已全部点名完成', true);
            this.stopRollCall();
            return;
        }

        rollState.isAnimating = true;
        UI.addAnimationClass();
        UI.updateButtonStates();

        const remaining = Array.from(rollState.remainingSet);
        let count = 0;
        const totalIterations = 12; // 动画迭代次数
        let currentInterval = 40; // 初始间隔（毫秒）

        const animate = () => {
            // 随机显示一个名字
            const randomIndex = Math.floor(Math.random() * remaining.length);
            UI.updateCurrentStudent(remaining[randomIndex]);

            count++;

            if (count < totalIterations) {
                // 逐渐减慢速度
                currentInterval = 40 + (count * 10);
                rollState.animationTimer = setTimeout(animate, currentInterval);
            } else {
                // 动画结束，选择最终的学生
                const finalIndex = Math.floor(Math.random() * remaining.length);
                const selectedStudent = remaining[finalIndex];

                rollState.currentStudent = selectedStudent;
                rollState.isAnimating = false;

                UI.updateCurrentStudent(selectedStudent);
                UI.removeAnimationClass();
                UI.updateButtonStates();
            }
        };

        animate();
    },

    nextStudent() {
        if (rollState.remainingSet.size === 0) {
            UI.updateCurrentStudent('已全部点名完成');
            UI.showMessage('已全部点名完成', true);
            this.stopRollCall();
            return;
        }

        let nextStudent;

        if (rollState.mode === 'random') {
            // 随机模式：启动动画
            this.startRandomAnimation();
            return;
        } else {
            // 顺序模式：按名单顺序
            while (rollState.currentIndex < students.length) {
                const student = students[rollState.currentIndex];
                if (rollState.remainingSet.has(student)) {
                    nextStudent = student;
                    break;
                }
                rollState.currentIndex++;
            }
        }

        rollState.currentStudent = nextStudent;
        UI.updateCurrentStudent(nextStudent);
    },

    markAttendance(status) {
        if (!rollState.started || !rollState.currentStudent || rollState.isAnimating) {
            return;
        }

        // 创建记录
        const record = {
            ts: Date.now(),
            name: rollState.currentStudent,
            status: status
        };

        // 添加到记录列表
        records.push(record);
        Storage.saveRecords(records);

        // 从剩余集合中移除
        rollState.remainingSet.delete(rollState.currentStudent);

        // 如果是顺序模式，推进索引
        if (rollState.mode === 'sequential') {
            rollState.currentIndex++;
        }

        // 更新统计
        UI.updateStudentCount();
        UI.updateRecordDisplay();
        UI.updateFilterCount();

        // 显示下一个学生
        this.nextStudent();
    },

    getFilteredRecords() {
        const startDate = UI.elements.startDate.value;
        const endDate = UI.elements.endDate.value;

        if (!startDate || !endDate) {
            return records;
        }

        const startTs = new Date(startDate + ' 00:00:00').getTime();
        const endTs = new Date(endDate + ' 23:59:59').getTime();

        return records.filter(record => {
            return record.ts >= startTs && record.ts <= endTs;
        });
    },

    exportRecords() {
        const filtered = this.getFilteredRecords();

        if (filtered.length === 0) {
            UI.showMessage('没有可导出的记录', false);
            return;
        }

        const csv = CSV.export(filtered);
        const filename = `考勤记录_${new Date().toISOString().split('T')[0]}.csv`;

        CSV.download(csv, filename);
        UI.showMessage(`成功导出 ${filtered.length} 条记录`, true);
    },

    clearRecords() {
        if (records.length === 0) {
            UI.showMessage('没有可清除的记录', false);
            return;
        }

        const confirmed = confirm(`确定要清除所有 ${records.length} 条记录吗？此操作不可恢复。`);

        if (confirmed) {
            records = [];
            Storage.clearRecords();

            UI.updateRecordDisplay();
            UI.updateFilterCount();
            UI.showMessage('已清除所有记录', true);
        }
    }
};

// ==================== 文件读取模块 ====================
const FileReader2 = {
    // 尝试多种编码读取文件
    readFileWithEncoding(file, callback) {
        // 先尝试用 UTF-8 读取
        const reader1 = new FileReader();
        reader1.onload = (e) => {
            const text = e.target.result;
            // 检查是否包含乱码（常见乱码特征）
            if (this.isGarbled(text)) {
                // 尝试用 GBK 读取
                const reader2 = new FileReader();
                reader2.onload = (e2) => {
                    callback(e2.target.result);
                };
                reader2.readAsText(file, 'GBK');
            } else {
                callback(text);
            }
        };
        reader1.readAsText(file, 'UTF-8');
    },

    // 检测文本是否为乱码
    isGarbled(text) {
        // 检查是否包含常见的乱码字符
        // UTF-8 解码 GBK 文件时会出现大量的替换字符（�）或其他乱码模式
        const garbledPattern = /[\ufffd\u0000-\u001f]/;
        const replacementCharCount = (text.match(/\ufffd/g) || []).length;

        // 如果替换字符超过一定比例，认为是乱码
        if (replacementCharCount > text.length * 0.1) {
            return true;
        }

        // 检查是否有连续的非打印字符
        if (garbledPattern.test(text.substring(0, 100))) {
            return true;
        }

        // 检查第一行是否能正常识别为"姓名"
        const firstLine = text.split(/\r?\n/)[0].trim();
        if (firstLine && firstLine !== '姓名' && firstLine.length <= 4) {
            // 如果第一行很短但不是"姓名"，可能是乱码
            const validChinesePattern = /^[\u4e00-\u9fa5]+$/;
            if (!validChinesePattern.test(firstLine)) {
                return true;
            }
        }

        return false;
    }
};

// ==================== 事件处理 ====================
const Events = {
    init() {
        // 导入 CSV
        UI.elements.importBtn.addEventListener('click', () => {
            UI.elements.csvFileInput.click();
        });

        UI.elements.csvFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            FileReader2.readFileWithEncoding(file, (text) => {
                try {
                    const names = CSV.parse(text);

                    if (names.length === 0) {
                        UI.showMessage('CSV 文件为空或格式不正确', false);
                        return;
                    }

                    students = names;
                    Storage.saveStudents(students);

                    // 重置点名状态
                    rollState.remainingSet = new Set(students);
                    rollState.currentIndex = 0;
                    rollState.started = false;
                    rollState.isAnimating = false;

                    UI.updateStudentCount();
                    UI.updateButtonStates();
                    UI.showMessage(`成功导入 ${names.length} 名学生`, true);
                } catch (error) {
                    console.error('解析 CSV 失败:', error);
                    UI.showMessage('解析 CSV 失败', false);
                }

                // 清空文件选择
                UI.elements.csvFileInput.value = '';
            });
        });

        // 开始/停止点名
        UI.elements.startBtn.addEventListener('click', () => {
            RollCall.startRollCall();
        });

        UI.elements.stopBtn.addEventListener('click', () => {
            RollCall.stopRollCall();
        });

        // 考勤按钮
        UI.elements.attendBtn.addEventListener('click', () => {
            RollCall.markAttendance('出勤');
        });

        UI.elements.lateBtn.addEventListener('click', () => {
            RollCall.markAttendance('迟到');
        });

        UI.elements.absentBtn.addEventListener('click', () => {
            RollCall.markAttendance('缺勤');
        });

        // 日期筛选
        UI.elements.startDate.addEventListener('change', () => {
            UI.updateFilterCount();
        });

        UI.elements.endDate.addEventListener('change', () => {
            UI.updateFilterCount();
        });

        // 导出/清除
        UI.elements.exportBtn.addEventListener('click', () => {
            RollCall.exportRecords();
        });

        UI.elements.clearBtn.addEventListener('click', () => {
            RollCall.clearRecords();
        });
    }
};

// ==================== 初始化 ====================
function init() {
    // 初始化 UI
    UI.init();

    // 加载数据
    students = Storage.loadStudents();
    records = Storage.loadRecords();

    // 初始化点名状态
    rollState.remainingSet = new Set(students);

    // 更新显示
    UI.updateStudentCount();
    UI.updateRecordDisplay();
    UI.updateButtonStates();
    UI.updateFilterCount();

    // 绑定事件
    Events.init();
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
