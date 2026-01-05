
/**
 * Calcula el Dígito de Verificación (DV) para un NIT según la metodología de la DIAN (Módulo 11).
 * 
 * Reglas:
 * - Solo aplica para NIT (que usualmente es tipo documento 31).
 * - No aplica para Cédulas (13), TI (12), etc., EXCEPTO si una person natural tiene NIT (31).
 * 
 * @param nit Número de identificación sin guiones ni puntos.
 * @returns El dígito de verificación como string (0-9). Retorna '' si el input no es válido.
 */
export const calcularDigitoVerificacion = (nit: string | number): string => {
    // 1. Limpiar input: remover cualquier caracter que no sea número
    const nitString = String(nit).replace(/\D/g, '');

    // Validar que no esté vacío y que sea numérico
    if (!nitString || isNaN(Number(nitString))) {
        return '';
    }

    // 2. Factores DIAN de derecha a izquierda (hasta 15 posiciones)
    // Pos: 1  2   3   4   5   6   7   8   9  10  11  12  13  14  15
    // Fac: 3  7  13  17  19  23  29  37  41  43  47  53  59  67  71
    const factores = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

    let suma = 0;
    const length = nitString.length;

    // 3. Multiplicar cada dígito (de derecha a izquierda) por su factor
    // Iteramos desde el último dígito hacia el primero
    for (let i = 0; i < length; i++) {
        // Obtener el dígito (de derecha a izquierda)
        // Ejemplo: NIT 802024306. Length 9.
        // i=0 -> nitString[8] ('6')
        const digito = parseInt(nitString.charAt(length - 1 - i), 10);

        // Obtener factor correspondiente a la posición (i es 0-indexed, factores array también)
        // i=0 corresponde a posición 1 DIAN (factor 3)
        const factor = factores[i];

        // Si el NIT es más largo que 15 (muy raro), se podría romper o asumir lógica. 
        // La tabla DIAN llega a 15. Asumimos que no excederá.
        if (factor !== undefined) {
            suma += digito * factor;
        }
    }

    // 4. Aplicar Módulo 11
    const residuo = suma % 11;

    // 5. Calcular DV
    // Regla: 
    // - Si residuo <= 1, DV = residuo
    // - Si residuo > 1, DV = 11 - residuo

    let dv;
    if (residuo <= 1) {
        dv = residuo;
    } else {
        dv = 11 - residuo;
    }

    return String(dv);
};
