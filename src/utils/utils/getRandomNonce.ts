export function getRandomNonce() {
    const random_suffix = Math.round(Math.random() * 999);
    return Number(`${Date.now()}${random_suffix}`);
}
