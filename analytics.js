(function () {

    // =========================
    // CONFIG
    // =========================
    const ENABLE_TRACKING = true; // 👈 toggle ON/OFF here
    if (!ENABLE_TRACKING) return;

    const USER_ID =
        localStorage.getItem("uid") ||
        crypto.randomUUID();

    localStorage.setItem("uid", USER_ID);

    const SITE = window.location.origin;

    const ANALYTICS_ENDPOINT =
        "http://127.0.0.1:5050/track"; // later replace with live server

    let startTime = Date.now();

    // =========================
    // PAYLOAD BUILDER
    // =========================
    function buildPayload(event, extra = {}) {
        return {
            user_id: USER_ID,
            site: SITE,
            event,
            time: new Date().toISOString(),
            duration: Math.floor((Date.now() - startTime) / 1000),
            ...extra
        };
    }

    // =========================
    // SERVER SEND
    // =========================
    function sendToServer(data) {
        fetch
