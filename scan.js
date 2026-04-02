// =====================================================================
// URL API и ключ запроса
// =====================================================================
const API_URL = 'https://circularly-predeterminate-adelaida.ngrok-free.dev/api/send-scaner-info/';
const API_KEY = 'hK9#vR2pL!qN5zX8'; // замени на свой ключ

// --- Отправка через fetch на FastAPI ---
async function sendViaApi(scannedText) {
    const user_id = tg?.initDataUnsafe?.user?.id;

    if (!user_id) {
        console.error('❌ user_id не определён в initDataUnsafe');
        showPopup('Не удалось определить пользователя. Попробуйте перезапустить.');
        return;
    }

    console.log('📡 Отправляем через API, user_id:', user_id);

    try {
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
            },
            body: JSON.stringify({
                result_scan: scannedText,
                user_id: user_id
            })
        });

        if (resp.ok) {
            console.log('✅ API ответил успехом');
        } else {
            const data = await resp.json().catch(() => ({}));
            console.warn('⚠️ API вернул ошибку:', resp.status, data);
            showPopup('Ошибка сервера: ' + (data?.detail || data?.message || resp.status));
            return;
        }
    } catch (e) {
        console.error('❌ Ошибка fetch:', e);
        showPopup('Не удалось отправить данные. Проверьте соединение.');
        return;
    }

    setTimeout(() => {
        if (tg?.close) tg.close();
    }, 300);
}
