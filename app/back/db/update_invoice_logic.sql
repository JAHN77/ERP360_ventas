-- =================================================================================
-- SCRIPT DE ACTUALIZACIÓN: Lógica de Estados y Numeración de Facturas
-- =================================================================================
USE ERP360;
GO

-- 1. TRIGGER: Actualización automática de estado basado en CUFE
-- =================================================================================
IF OBJECT_ID('trg_UpdateEstadoFactura', 'TR') IS NOT NULL
    DROP TRIGGER trg_UpdateEstadoFactura;
GO

CREATE TRIGGER trg_UpdateEstadoFactura
ON ven_facturas
AFTER UPDATE, INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Solo actuamos si la columna CUFE ha sido modificada o insertada
    IF UPDATE(CUFE)
    BEGIN
        -- Actualizar a 'A' (Aprobado) si hay un CUFE válido
        UPDATE f
        SET estfac = 'A'
        FROM ven_facturas f
        INNER JOIN inserted i ON f.ID = i.ID
        WHERE i.CUFE IS NOT NULL 
          AND LEN(i.CUFE) > 20 -- Validación simple de longitud de CUFE real
          AND i.CUFE NOT LIKE '%RECHAZO%' -- Asegurar que no sea un mensaje de error
          AND i.CUFE NOT LIKE '%ERROR%'
          AND f.estfac != 'A'; -- Solo si no está ya aprobada

        -- Actualizar a 'R' (Rechazado) si el CUFE indica rechazo explícito
        UPDATE f
        SET estfac = 'R'
        FROM ven_facturas f
        INNER JOIN inserted i ON f.ID = i.ID
        WHERE i.CUFE IS NOT NULL 
          AND (i.CUFE LIKE '%RECHAZO%' OR i.CUFE LIKE '%ERROR%' OR i.CUFE = 'RECHAZADO')
          AND f.estfac != 'R';
    END
END;
GO

-- 2. PROCEDIMIENTO: Obtener siguiente número de factura (Lógica Descendente)
-- =================================================================================
IF OBJECT_ID('sp_GetSiguienteNumeroFactura', 'P') IS NOT NULL
    DROP PROCEDURE sp_GetSiguienteNumeroFactura;
GO

CREATE PROCEDURE sp_GetSiguienteNumeroFactura
    @EmpresaId INT = NULL,
    @SiguienteNumero VARCHAR(15) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UltimoNumero BIGINT;
    DECLARE @UltimoNumeroStr VARCHAR(15);
    DECLARE @UltimoEstado VARCHAR(1);
    DECLARE @UltimoID INT;

    -- Obtener la última factura registrada (por ID, que es el orden cronológico de creación)
    SELECT TOP 1 
        @UltimoID = ID,
        @UltimoNumeroStr = numfact,
        @UltimoEstado = estfac
    FROM ven_facturas
    WHERE (@EmpresaId IS NULL OR codalm = CAST(@EmpresaId AS VARCHAR(3)))
      AND ISNUMERIC(numfact) = 1
    ORDER BY ID DESC;

    -- Lógica de numeración
    IF @UltimoNumeroStr IS NULL
    BEGIN
        -- Si no hay facturas, iniciar en 89000 (o el valor que definas)
        SET @UltimoNumero = 89000;
    END
    ELSE
    BEGIN
        SET @UltimoNumero = CAST(@UltimoNumeroStr AS BIGINT);

        -- Si la última fue RECHAZADA ('R'), reutilizamos el número
        IF @UltimoEstado = 'R'
        BEGIN
            -- No cambiamos el número
            SET @UltimoNumero = @UltimoNumero;
        END
        ELSE
        BEGIN
            -- Si fue Aprobada ('A'), Enviada ('E') o cualquier otro estado, restamos 1
            SET @UltimoNumero = @UltimoNumero - 1;
        END
    END

    SET @SiguienteNumero = CAST(@UltimoNumero AS VARCHAR(15));
    
    -- Devolver el resultado
    SELECT @SiguienteNumero AS SiguienteNumero;
END;
GO
