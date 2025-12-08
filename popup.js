document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('rules-container');
  const addBtn = document.getElementById('add-btn');
  const statusMsg = document.getElementById('status-msg');
  const infoBtn = document.getElementById('info-btn');
  const infoModal = document.getElementById('info-modal');

  // 初始化：从 storage 加载数据
  const data = await chrome.storage.local.get('headers');
  let headers = data.headers || [{ enabled: true, name: '', value: '' }]; 

  render();

  // 渲染函数
  function render() {
    container.innerHTML = '';
    headers.forEach((header, index) => {
      const row = document.createElement('div');
      row.className = 'header-row';

      // 1. 复选框
      const checkDiv = document.createElement('div');
      checkDiv.className = 'col-check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = header.enabled;
      checkbox.onchange = (e) => {
        headers[index].enabled = e.target.checked;
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
        headers[index].name = e.target.value;
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
        headers[index].value = e.target.value;
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
        headers.splice(index, 1);
        saveAndApply();
        render(); 
      };
      delDiv.appendChild(delBtn);

      row.appendChild(checkDiv);
      row.appendChild(nameDiv);
      row.appendChild(valueDiv);
      row.appendChild(delDiv);
      container.appendChild(row);
    });
  }

  addBtn.onclick = () => {
    headers.push({ enabled: true, name: '', value: '' });
    render();
  };

  // ------ 核心逻辑 ------
  async function saveAndApply() {
    // 1. 保存到 storage
    await chrome.storage.local.set({ headers });

    // 2. 构建 DNR 规则
    const rules = [];
    let idCounter = 1;

    headers.forEach(h => {
      if (h.enabled && h.name.trim()) {
		  
		//这个逻辑是将中文进行URL编码，这样可以支持 `Cookie: user=张三;` 变成 `Cookie: user=%E5%BC%A0%E4%B8%89;`
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
                value: safeValue  //h.value 表示引用原始值，safeValue使用处理后的值
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

    // 3. 更新 Chrome 网络规则
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
