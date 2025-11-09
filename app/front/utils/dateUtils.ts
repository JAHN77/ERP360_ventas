export const timeSince = (date: number): string => {
  const seconds = Math.floor((Date.now() - date) / 1000);

  if (seconds < 5) {
    return "justo ahora";
  }

  let interval = seconds / 31536000;
  if (interval > 1) {
    const years = Math.floor(interval);
    return `hace ${years} ${years === 1 ? 'año' : 'años'}`;
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    const months = Math.floor(interval);
    return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
  interval = seconds / 86400;
  if (interval > 1) {
    const days = Math.floor(interval);
    return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
  }
  interval = seconds / 3600;
  if (interval > 1) {
    const hours = Math.floor(interval);
    return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  interval = seconds / 60;
  if (interval > 1) {
    const minutes = Math.floor(interval);
    return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  }
  return "hace unos segundos";
};
