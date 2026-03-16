const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const upload = document.getElementById('upload');
const dropZone = document.getElementById('dropZone');
const placeholder = document.getElementById('uploadPlaceholder');
const compLine = document.getElementById('comparisonLine');
const dotResSlider = document.getElementById('dotRes');
const crtFilterSlider = document.getElementById('scanline');
const splitSlider = document.getElementById('splitSlider');
const splitSliderContainer = document.getElementById('splitSliderContainer');
const resetBtn = document.getElementById('resetBtn');

let originalImage = new Image();
let cachedOffCanvas = null; 

let maskCanvas = null;
let lastRes = -1;
let lastW = -1;
let lastH = -1;

// [이미지 업로드 및 인터랙션]
dropZone.onclick = (e) => {
    if (dropZone.classList.contains('empty')) upload.click();
};
dropZone.ondragover = (e) => { e.preventDefault(); if(dropZone.classList.contains('empty')) dropZone.style.borderColor = '#33ff33'; };
dropZone.ondragleave = () => { if(dropZone.classList.contains('empty')) dropZone.style.borderColor = '#ff9900'; };
dropZone.ondrop = (e) => {
    e.preventDefault();
    if (dropZone.classList.contains('empty')) {
        dropZone.style.borderColor = '#ff9900';
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    }
};

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage = new Image();
        originalImage.src = e.target.result;
        originalImage.onload = () => {
            placeholder.style.display = 'none';
            compLine.style.display = 'block';
            dropZone.classList.remove('empty');
            
            // ★ 오차 해결의 핵심: 업로드된 이미지와 캔버스 영역의 비율을 똑같이 맞춤 ★
            dropZone.style.aspectRatio = originalImage.width / originalImage.height;
            
            // 하단 슬라이더 보이기 및 50% 초기화
            splitSliderContainer.style.display = 'block';
            splitSlider.value = 50;
            compLine.style.left = "50%";
            
            cachedOffCanvas = null;
            applyEffect();
        };
    };
    reader.readAsDataURL(file);
}

upload.onchange = (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); };

resetBtn.onclick = () => {
    if (dropZone.classList.contains('empty')) return;
    originalImage = new Image();
    placeholder.style.display = 'block';
    compLine.style.display = 'none';
    dropZone.classList.add('empty');
    dropZone.style.borderColor = '#ff9900';
    
    // 비율 및 슬라이더 숨기기 원상복구
    dropZone.style.aspectRatio = '4 / 3';
    splitSliderContainer.style.display = 'none';
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    upload.value = "";
    cachedOffCanvas = null;
};

function generateMask(w, h, res) {
    if (maskCanvas && lastRes === res && lastW === w && lastH === h) return;
    
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = w; maskCanvas.height = h;
    const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    
    mCtx.fillStyle = '#000';
    mCtx.fillRect(0, 0, w, h);

    const baseDx = w / res; 
    const dx = baseDx / 2; 
    const dy = dx * 0.866025; 
    const radius = (dx / 2) * 1.05; 

    for (let row = 0; row < (h / dy) + 2; row++) {
        const isOddRow = row % 2 !== 0;
        const offsetX = isOddRow ? (dx / 2) : 0; 

        for (let col = -1; col < (w / dx) + 2; col++) {
            const tx = col * dx + offsetX;
            const ty = row * dy;

            if (tx > w + radius * 2 || ty > h + radius * 2) continue;

            let colorIdx = (!isOddRow) ? ((col % 3) + 3) % 3 : (((col + 2) % 3) + 3) % 3;

            if (colorIdx === 0) mCtx.fillStyle = `rgb(255,0,0)`;
            else if (colorIdx === 1) mCtx.fillStyle = `rgb(0,255,0)`;
            else mCtx.fillStyle = `rgb(0,0,255)`;

            mCtx.beginPath();
            mCtx.arc(tx, ty, radius, 0, Math.PI * 2);
            mCtx.fill();
        }
    }
    lastRes = res; lastW = w; lastH = h;
}

function applyEffect() {
    if (!originalImage.src) return;
    const w = originalImage.width;
    const h = originalImage.height;
    canvas.width = w; canvas.height = h;

    const res = parseInt(dotResSlider.value);
    const crtInt = parseFloat(crtFilterSlider.value) / 100;

    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');
    offCanvas.width = w; offCanvas.height = h;

    const sCanvas = document.createElement('canvas');
    const sCtx = sCanvas.getContext('2d');
    sCanvas.width = res; sCanvas.height = Math.round(res * (h / w));
    sCtx.drawImage(originalImage, 0, 0, sCanvas.width, sCanvas.height);

    if (crtInt === 0) {
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(sCanvas, 0, 0, sCanvas.width, sCanvas.height, 0, 0, w, h);
    } else {
        sCtx.globalCompositeOperation = 'lighten';
        sCtx.fillStyle = 'rgb(20, 20, 20)'; 
        sCtx.fillRect(0, 0, sCanvas.width, sCanvas.height);
        sCtx.globalCompositeOperation = 'source-over';

        const crtCanvas = document.createElement('canvas');
        const crtCtx = crtCanvas.getContext('2d');
        crtCanvas.width = w; crtCanvas.height = h;
        
        crtCtx.imageSmoothingEnabled = false;
        crtCtx.drawImage(sCanvas, 0, 0, sCanvas.width, sCanvas.height, 0, 0, w, h);

        generateMask(w, h, res);
        
        crtCtx.globalCompositeOperation = 'multiply';
        crtCtx.drawImage(maskCanvas, 0, 0);
        crtCtx.globalCompositeOperation = 'source-over';

        const dx = (w / res) / 2;
        const brightnessVal = 2.8 + (crtInt * 1.5); 
        const contrastVal = 1.1 + (crtInt * 0.3); 
        const saturateVal = 1.3 + (crtInt * 0.5); 

        offCtx.fillStyle = '#000';
        offCtx.fillRect(0, 0, w, h);
        
        offCtx.filter = `blur(${crtInt * dx * 0.3}px) contrast(${contrastVal}) brightness(${brightnessVal}) saturate(${saturateVal})`;
        offCtx.drawImage(crtCanvas, 0, 0);
    }
    
    cachedOffCanvas = offCanvas; 
    render(offCanvas);
}

function render(offCanvas) {
    const w = canvas.width; const h = canvas.height;
    ctx.drawImage(originalImage, 0, 0, w, h);
    
    const splitPercent = splitSlider.value / 100;
    const splitPos = w * splitPercent;
    
    ctx.drawImage(offCanvas, 0, 0, splitPos, h, 0, 0, splitPos, h);
}

dotResSlider.oninput = (e) => { document.getElementById('resVal').innerText = e.target.value; applyEffect(); };
crtFilterSlider.oninput = (e) => { document.getElementById('scanVal').innerText = (e.target.value / 100).toFixed(1); applyEffect(); };

// ★ 하단 슬라이더 조작 이벤트
splitSlider.oninput = (e) => {
    compLine.style.left = e.target.value + "%";
    if (cachedOffCanvas) render(cachedOffCanvas);
};

document.getElementById('downloadBtn').onclick = () => {
    if (!originalImage.src) return;
    const link = document.createElement('a');
    link.download = 'retro-crt-result.png';
    link.href = canvas.toDataURL();
    link.click();
};

const viewBtn = document.getElementById('viewOriginal');
viewBtn.onmousedown = () => { 
    if(originalImage.src) { 
        const prevVal = splitSlider.value;
        splitSlider.value = 0; 
        compLine.style.left = "0%";
        if (cachedOffCanvas) render(cachedOffCanvas);
        
        const restore = () => { 
            splitSlider.value = prevVal; 
            compLine.style.left = prevVal + "%";
            if (cachedOffCanvas) render(cachedOffCanvas); 
        };
        
        viewBtn.onmouseup = restore;
        viewBtn.onmouseleave = restore; 
    }
};