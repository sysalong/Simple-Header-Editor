document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('rules-container');
  const addBtn = document.getElementById('add-btn');
  const statusMsg = document.getElementById('status-msg');
  const infoBtn = document.getElementById('info-btn');
  const infoModal = document.getElementById('info-modal');
  
  // Profile 相关 DOM
  const profileSelect = document.getElementById('profile-select');
  const addProfileBtn = document.getElementById('add-profile-btn');
  const delProfileBtn = document.getElementById('del-profile-btn');
  const renameProfileBtn = document.getElementById('rename-profile-btn');

  // 全局变量
  let allProfiles = {}; // 存储所有配置 { "Default": [...], "Test": [...] }
  let currentProfileName = 'Default'; // 当前选中的配置名
  let currentHeaders = []; // 当前配置下的 header 列表

  // 初始化
  await initData();

  async function initData() {
    const data = await chrome.storage.local.get(['headers', 'profiles', 'currentProfile']);
    
    // === 数据迁移逻辑 ===
    // 如果用户有旧版数据 (data.headers) 但没有新版结构 (data.profiles)
    if (data.headers && !data.profiles) {
      allProfiles = { 'Default': data.headers };
      currentProfileName = 'Default';
      // 清除旧结构以防混淆(可选，这里选择保留在 profiles 里覆盖)
    } else {
      // 正常加载或全新加载
      allProfiles = data.profiles || { 'Default': [{ enabled: true, name: '', value: '' }] };
      currentProfileName = data.currentProfile || 'Default';
    }

    // 确保当前 Profile 存在（防止删除了当前 Profile 后数据错乱）
    if (!allProfiles[currentProfileName]) {
      currentProfileName = Object.keys(allProfiles)[0] || 'Default';
      if (!allProfiles[currentProfileName]) {
         allProfiles[currentProfileName] = [{ enabled: true, name: '', value: '' }];
      }
    }

    currentHeaders = allProfiles[currentProfileName];
    
    renderProfileSelect();
    renderRules();
  }

  // ------ UI 渲染 ------

  // 渲染配置下拉框
  function renderProfileSelect() {
    profileSelect.innerHTML = '';
    Object.keys(allProfiles).forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === currentProfileName) option.selected = true;
      profileSelect.appendChild(option);
    });
  }

  // 渲染规则列表 (核心渲染逻辑)
  function renderRules() {
    container.innerHTML = '';
    currentHeaders.forEach((header, index) => {
      const row = document.createElement('div');
      row.className = 'header-row';

      // 1. 复选框
      const checkDiv = document.createElement('div');
      checkDiv.className = 'col-check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = header.enabled;
      checkbox.onchange = (e) => {
        currentHeaders[index].enabled = e.target.checked;
        saveAndApply();
      };
      checkDiv.appendChild(checkbox);

      // 2. Name 输入框
      const nameDiv = document.createElement('div');
      nameDiv.className = 'col-input';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Name';
      nameInput.value = header.name;
      nameInput.oninput = (e) => {
        currentHeaders[index].name = e.target.value;
        saveAndApply();
      };
      nameDiv.appendChild(nameInput);

      // 3. Value 输入框
      const valueDiv = document.createElement('div');
      valueDiv.className = 'col-input';
      const valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.placeholder = 'Value';
      valueInput.value = header.value;
      valueInput.oninput = (e) => {
        currentHeaders[index].value = e.target.value;
        saveAndApply();
      };
      valueDiv.appendChild(valueInput);

      // 4. 删除按钮
      const delDiv = document.createElement('div');
      delDiv.className = 'col-del';
      const delBtn = document.createElement('button');
      delBtn.className = 'del-btn';
      delBtn.innerText = '×';
      delBtn.onclick = () => {
        currentHeaders.splice(index, 1);
        saveAndApply();
        renderRules(); 
      };
      delDiv.appendChild(delBtn);

      row.appendChild(checkDiv);
      row.appendChild(nameDiv);
      row.appendChild(valueDiv);
      row.appendChild(delDiv);
      container.appendChild(row);
    });
  }

  // ------ 事件监听 ------

  // 切换配置
  profileSelect.onchange = (e) => {
    currentProfileName = e.target.value;
    currentHeaders = allProfiles[currentProfileName];
    // 切换配置时，不仅要保存状态，还要立即把新配置的规则应用到 DNR
    saveAndApply();
    renderRules();
  };

  // 添加新配置
  addProfileBtn.onclick = () => {
    const name = prompt("请输入新配置名称 (例如: Dev, Prod):");
    if (name && name.trim()) {
      const cleanName = name.trim();
      if (allProfiles[cleanName]) {
        alert("该配置名称已存在！");
        return;
      }
      // 创建新配置 (默认空)
      allProfiles[cleanName] = [{ enabled: true, name: '', value: '' }];
      // 切换到新配置
      currentProfileName = cleanName;
      currentHeaders = allProfiles[cleanName];
      
      renderProfileSelect();
      renderRules();
      saveAndApply();
    }
  };

  // 重命名配置
  renameProfileBtn.onclick = () => {
      const newName = prompt("请输入新的配置名称:", currentProfileName);
      if (newName && newName.trim() && newName !== currentProfileName) {
          const cleanName = newName.trim();
          if (allProfiles[cleanName]) {
              alert("该名称已存在，请使用其他名称");
              return;
          }
          // 迁移数据
          allProfiles[cleanName] = allProfiles[currentProfileName];
          delete allProfiles[currentProfileName];
          currentProfileName = cleanName;

          renderProfileSelect();
          saveAndApply();
      }
  };

  // 删除配置
  delProfileBtn.onclick = () => {
    const keys = Object.keys(allProfiles);
    if (keys.length <= 1) {
      alert("至少需要保留一个配置！");
      return;
    }
    if (confirm(`确定要删除配置 "${currentProfileName}" 吗？`)) {
      delete allProfiles[currentProfileName];
      // 删除后切换到第一个可用的配置
      currentProfileName = Object.keys(allProfiles)[0];
      currentHeaders = allProfiles[currentProfileName];

      renderProfileSelect();
      renderRules();
      saveAndApply();
    }
  };

  // 添加规则行
  addBtn.onclick = () => {
    currentHeaders.push({ enabled: true, name: '', value: '' });
    renderRules();
  };

  // ------ 核心逻辑 (保存 + DNR应用) ------
  async function saveAndApply() {
    // 1. 更新内存中的大对象
    allProfiles[currentProfileName] = currentHeaders;

    // 2. 保存到 storage
    // 注意：我们不再保存顶层的 headers，而是保存 profiles 和 currentProfile
    await chrome.storage.local.set({ 
      profiles: allProfiles,
      currentProfile: currentProfileName
    });

    // 3. 构建 DNR 规则 (仅使用当前选中的 Profile 中的 headers)
    const rules = [];
    let idCounter = 1;

    currentHeaders.forEach(h => {
      if (h.enabled && h.name.trim()) {
        const safeValue = h.value.replace(/[^\x00-\x7F]/g, (match) => encodeURIComponent(match));
        
        rules.push({
          id: idCounter++,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              { 
                header: h.name.trim(), 
                operation: "set", 
                value: safeValue 
              }
            ]
          },
          condition: {
            urlFilter: "*",
            resourceTypes: [
              "main_frame", "sub_frame", "stylesheet", "script", 
              "image", "font", "object", "xmlhttprequest", "ping", 
              "csp_report", "media", "websocket", "other"
            ]
          }
        });
      }
    });

    // 4. 更新 Chrome 网络规则
    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    const oldRuleIds = oldRules.map(rule => rule.id);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldRuleIds,
      addRules: rules
    });

    showStatus();
  }

  let statusTimeout;
  function showStatus() {
    statusMsg.classList.add('show');
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      statusMsg.classList.remove('show');
    }, 2000);
  }

  // Info 按钮逻辑
  infoBtn.onclick = () => {
    infoModal.style.display = 'flex';
  };
  infoModal.onclick = () => {
    infoModal.style.display = 'none';
  };
});