

const urlParams = new URLSearchParams(window.location.search);
const isTestMode = urlParams.get('testMode') === 'true';

console.log('isTestMode', isTestMode);
export const config = {
    prepopulateChat: isTestMode,
}