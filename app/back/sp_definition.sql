
ALTER PROCEDURE [dbo].[Sp_Grabar_Factura_Venta]                                            
@codalm CHAR(3) ,                                            
@codter VARCHAR(15) ,                                            
@fecha DATETIME ,                                            
@codven CHAR(3) ,                                      
@tipfac CHAR(2)='FC',                                           
@subtotal float  ,                                            
@Totdescuento float,                                            
@total_iva float  ,                                            
@anticipo_aplicado NUMERIC(18,2)=0 ,                                            
@valdomicilio NUMERIC(18, 0),                                            
@total_factura float ,                                            
@Aplicar_Retencion BIT = 0 ,                                            
@codusu CHAR(10) ,                                          
@codigo_dian char(4),                                      
@clase char(4) ,                                      
@venfac DATETIME,                                           
@valcosto float,                                              
@valret float,                                            
@Tasaret Numeric(5,2),
@valrica NUMERIC(12,0),                                            
@valriva NUMERIC(12, 0),                                        
@observa VARCHAR(150), 
@Lugar_Entrega nvarchar(50),
@orden nvarchar(10),
@codtar varchar(2),                                      
@pagos nvarchar(max),                                           
@DETALLE nvarchar(max), @CUFE VARCHAR(100) = NULL                                           
AS                                            
BEGIN TRY                                            
BEGIN TRAN;                                             
 SET DATEFORMAT DMY;                                            
 ---Bloque declaracion de variables                                         
 declare @CuentaCaja CHAR(8),@CtaCredito CHAR(8),                                            
 @efectivo NUMERIC(18,2),@cheques NUMERIC(18, 2),@credito float,@tarjetadb NUMERIC(18, 0),@tarjetacr NUMERIC(13, 2),@factura char(12),                            
 @COMPROBANTE VARCHAR(12),                             
 @TERCERO VARCHAR(50),@PERIODO CHAR(6), @cta_domicilio  char(8),@TERCERO_DOMICILIO VARCHAR(15),@transferencia numeric(18,2), @consignado numeric(18,2),                                        
 @cheque varchar(10),@bco varchar(5),@CODBCO VARCHAR(4),@CODFRANQUICIA VARCHAR(3),@CODcuenta varchar(8), @CODFRANQUICIACR VARCHAR(3), @valpagado float                                         
 ,@id integer =0                      
                                               
 DECLARE @netfac NUMERIC(12,0),@abofac float,@DES BIT =0--&& ESTA ULTIMA ES PARA SABER SI EL ERROR SON COMPROBANTES DESCUADRADOS                                               
                                     
-- Actualiza el consecutivo de facturacion                                            
IF ISJSON(@PAGOS)=0 -- valido que sea un JSON                                             
BEGIN                                             
 Raiserror('Json de PAGOS inválido %s',16,-1,' ¡Se cancelan todas las transacciones!')                                                   
END;   
--select * from DBO.VEN_DETALLE_PAGOS (@PAGOS)
IF ISJSON(@DETALLE)=0 -- valido que sea un JSON                                             
BEGIN                                             
 Raiserror('Json del detalle inválido %s',16,-1,' ¡Se cancelan todas las transacciones!')                                                   
END;                                            
                                      
 begin                                     
                                
   If NOT EXISTS(SELECT CODIGO from Dian_Resoluciones WHERE TRIM(codalm) = TRIM(@codalm) and activa=1 
	AND TRIM(CODIGO) = TRIM(@codigo_dian) and fecha_vencimiento>=@fecha)                                
    begin                                        
    Raiserror(' No existe resolucion de la dian activa %s',16,-1,'¡ERROR!')                                    
 end;                                 
 IF NOT EXISTS(SELECT CODFUE FROM CON_FUENTES WHERE CODFUE=@tipfac)                        
 BEGIN                                 
  INSERT INTO CON_FUENTES (CODFUE,NOMFUE,clafue,MODFUE,NUEFUE,FUESYS,campo,FUEPRE)                                
  VALUES (@tipfac,iif(@tipfac='FC','Factura de Venta Electrónica Credito','Factura Electronica a clientes'),'U',1,0,0,'',0)                                
 END     

 IF NOT EXISTS(SELECT tipo_documento FROM gen_consecutivos WHERE Tipo_documento=@tipfac and codalm=@codalm)                        
 BEGIN                                 
  INSERT INTO gen_consecutivos (codalm,Tipo_documento,nombre,clase,consecutivo)                                
  VALUES (@codalm,@tipfac,iif(@tipfac='FC','Factura de Venta Electrónica Credito','Factura Electronica a clientes'),'U',0)                                
 END                                    
  
 --Se actualiza el consecutivo   
	declare @consecutivo integer 
	
	select @consecutivo = dbo.consecutivo_factura(@codalm,@clase)

   UPDATE Dian_Resoluciones SET consecutivo = ISNULL(@consecutivo,isnull(@consecutivo,0))+1                                       
   WHERE codalm =@CODALM AND clase = @clase AND activa=1 AND codigo=@codigo_dian                                      
                                      
   -- Saca los consecutivos actualizados                                       
   SELECT @Factura = isnull(consecutivo,0)                               
   FROM  Dian_Resoluciones                                      
   where codalm =@codalm and activa=1 and Codigo=@codigo_dian       
   set @factura = trim(@factura)    
 end                                      
 --declare @moroso int = 1
 --if @moroso = 1
 --BEGIN                                             
 -- Raiserror('Estado del Cliente: Mora', 16, -1)                                                   
 --END;  
 
 SELECT @COMPROBANTE = DBO.PADL(YEAR(@fecha),4,'0')+'-'+ right(trim(@Factura),7)                          
 SELECT @PERIODO = DBO.PADL(YEAR(@fecha),4,'0')+DBO.PADL(MONTH(@fecha),2,'0')                                        
                                          
   --- Consultamos la forma de pago                                            
    SELECT  @efectivo = ISNULL(SUM(Valor), 0) FROM  DBO.VEN_DETALLE_PAGOS (@PAGOS)  WHERE   FORMAPAGO = 'EF' ;                                          
    SELECT  @cheques = ISNULL(SUM(Valor), 0), @cheque=isnull(cheque,'') ,@bco=isnull(bco,'') FROM DBO.VEN_DETALLE_PAGOS (@PAGOS)  WHERE   FORMAPAGO = 'CH'group by cheque, bco;                                                  
    SELECT  @tarjetadb = ISNULL(SUM(Valor), 0.00), @CODFRANQUICIA= isnull(FRANQUICIA,'') FROM DBO.VEN_DETALLE_PAGOS (@PAGOS)  WHERE   FORMAPAGO = 'TD'  group by Franquicia;                                                  
    SELECT  @tarjetacr = ISNULL(SUM(Valor), 0.00), @CODFRANQUICIACR= isnull(FRANQUICIA,'') FROM DBO.VEN_DETALLE_PAGOS (@PAGOS)  WHERE   FORMAPAGO = 'TC'  group by Franquicia;                                                  
    SELECT  @credito = ISNULL(SUM(Valor), 0) FROM DBO.VEN_DETALLE_PAGOS (@PAGOS)  WHERE   FORMAPAGO = 'CR' ;                                                  
    SELECT  @transferencia = ISNULL(SUM(Valor), 0), @CODBCO = ISNULL(BCO,'') FROM DBO.VEN_DETALLE_PAGOS (@PAGOS) WHERE   FORMAPAGO in('TB','TR') group by FORMAPAGO,BCO;                                                  
                                          
 --calculamos el abono                                      
  SET @abofac =ISNULL(@efectivo, 0)+ISNULL(@cheques, 0)+ISNULL(@tarjetadb, 0)+ISNULL(@tarjetacr, 0)+isnull(@transferencia,0.00)                                 
  SET @valpagado =@ABOFAC                                      
 --Cuenta del banco donde se hizo la transferencia                                         
    SELECT @CODcuenta = CODCUE FROM TES_CUENBAN WHERE codcba =  @CODBCO                                         
                                            
 ---Generamos los parametros para las cuentas de Caja y Tesoreria                                             
    Select @cta_domicilio  = cuenta_domicilios,@TERCERO_DOMICILIO = TERCERO_DOMICILIO from gen_parametros_ventas                                            
    SELECT @TERCERO = TRIM(ISNULL(NOMTER,'NO REGISTRA')) FROM CON_TERCEROS WHERE CODTER=@CODTER                                            
                                       
  begin                        
  DECLARE @CON_COMPROB TABLE (CODCEN CHAR(3),                                      
  FUECOC CHAR(2),DOCCOC CHAR(12),                                  
  CODCUE CHAR(8),                                  
  FECCOC DATE,                                  
  DEBCOC NUMERIC(18,2),                                  
  CRECOC NUMERIC(18,2),                                      
  doc_interfase VARCHAR(15),                                      
  CODCOS CHAR(3),                                      
  DETCOC  VARCHAR(150),                    
  CODTER VARCHAR(15),                                      
  PERIODO CHAR(6),                                      
  CODUSU CHAR(10),                                      
  checoc char(50) DEFAULT space(1),                     
  BASERET NUMERIC(18,2) DEFAULT 0.00,                                      
  fecsys DATETIME)                                  
                                           
   --Generamos la contabilidad para los métodos de pago                                      
  INSERT INTO @CON_COMPROB (CODCEN,FUECOC,DOCCOC,CODCUE,FECCOC,DEBCOC,CRECOC,doc_interfase,CODCOS,DETCOC,CODTER,checoc,PERIODO,CODUSU,fecsys)                                        
  select  @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC,codcue,FECHA,VALOR as debcoc,0.00 as crecoc, @FACTURA AS doc_interfase,                                        
   @CODALM AS CODCEN,'Valor pagado '+IIF(@credito>0,'en ','con ')+lower(NOMBRE)+' en la factura N° '+trim(@factura)+' cliente: '+trim(@TERCERO) as detcoc,                                        
   @codter,trim(iif(CHEQUE='EFECTIVO','',CHEQUE)) as checoc,@PERIODO AS PERIODO,@codusu,getdate()                           
  from VEN_DETALLE_PAGOS(@pagos)                                        
                                          
   --Se genera la contabilidad de la venta,el iva, y las retencion si aplica                                        
  INSERT INTO @CON_COMPROB(CODCEN,FUECOC,DOCCOC,CODCUE,FECCOC,DEBCOC,CRECOC,doc_interfase,CODCOS,DETCOC,CODTER,PERIODO,CODUSU,fecsys,BASERET)
  Select @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC,cp.cuenta_ventas as Codcue,                                        
  @FECHA AS FECCOC,0 AS DEBCOC,round(sum(VALOR_PARCIAL),0)-round(sum(dv.totdescuento),0) as crecoc,---@Totdescuento                            
  @FACTURA AS doc_interfase,@CODALM AS CODCOS,'Venta de mercancias factura de venta N° '+trim(@factura)+' cliente: '+trim(@TERCERO) as DETCOC,   
  @Codter,@PERIODO AS PERIODO,@codusu,getdate(),0.00 AS BASERET
  From  dbo.json_detalle_factura (@DETALLE) dv                                         
  INNER join Inv_Insumos I on I.codins = Dv.codins                                 
  inner join con_interfaz_producto cp on trim(cp.Codigo)=trim(i.codigo_interfase)                              
  where left(dv.codins,2) != 'S-'                                    
  GROUP BY cp.Cuenta_Ventas                                        
  UNION   all                           
  Select @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC,i.codcue as Codcue,                                        
  @FECHA AS FECCOC,0 AS DEBCOC,round(sum(VALOR_PARCIAL),0)-round(sum(dv.totdescuento),0) as crecoc,---@Totdescuento                            
  @FACTURA AS doc_interfase,@CODALM AS CODCOS,'Venta de servicios factura de venta N° '+trim(@factura)+' cliente: '+trim(@TERCERO)  as DETCOC,                                         
  @Codter,@PERIODO AS PERIODO,@codusu,getdate()   ,0.00 AS BASERET
  From  dbo.json_detalle_factura (@DETALLE) dv                                         
  INNER join ven_servicios I on I.codins = Dv.codins                                            
  where left(dv.codins,2) = 'S-'                          
  group by i.codcue                     
  union    all                               
  Select @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC,cp.CUENTAIVA_VENTAS  as Codcue,                                           
  @FECHA AS FECCOC,0 AS DEBCOC,round(sum(Valor_IVA),0) as crecoc,     
 @FACTURA AS doc_interfase,@CODALM AS CODCOS, 'IVA en factura de venta N° '+trim(@factura)+' cliente: '+trim(@TERCERO) as Detcoc,                                            
  @Codter,@PERIODO AS PERIODO,@codusu,getdate(),round(sum(VALOR_PARCIAL),0)-round(sum(dv.totdescuento),0) AS BASERET
  From  dbo.json_detalle_factura (@DETALLE) dv                                         
  INNER join Inv_Insumos I on I.codins = Dv.codins                                
  inner join con_interfaz_producto cp on trim(cp.Codigo)=trim(i.codigo_interfase)                                        
  group by cp.CuentaIva_Ventas                                        
  HAVING round(sum(Valor_IVA),0) >0                                        
                                     
  UNION  all                                        
  Select @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC,cp.CUENTA_RETENCION_VENTAS  as Codcue,                                            
  @FECHA AS FECCOC,ROUND(sum((VALOR_PARCIAL-dv.totdescuento)*(dv.Tasa_Retencion*0.01)),0)  as DEBCOC,0 AS CRECOC,                                            
  @FACTURA AS doc_interfase,@CODALM AS CODCOS, 'Retefuente aplicado a la factura de venta N° '+trim(@factura)+' cliente:'+trim(@TERCERO) as Detcoc,      
  @codter,@PERIODO AS PERIODO,@codusu,getdate(),round(sum(VALOR_PARCIAL),0)-round(sum(dv.totdescuento),0) AS BASERET                                     
  From  dbo.json_detalle_factura (@DETALLE) dv                                         
  INNER join Inv_Insumos I on I.codins = Dv.codins                                          
  inner join con_interfaz_producto cp on trim(cp.Codigo)=trim(i.codigo_interfase)                                 
  WHERE @Aplicar_Retencion = 1 and @valret>0
  group by cp.CUENTA_RETENCION_VENTAS,cp.BASE_RETENCION                                            
  HAVING ROUND(sum(VALOR_PARCIAL-dv.totdescuento),0) > cp.BASE_RETENCION 
                             
  UNION all                                                                                 
  Select @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC,CUENTA_COSTOS as Codcue,                                            
  @FECHA AS FECCOC,ROUND(SUM(QTYVTA * cosvta),0)  as DEBCOC,0 AS CRECOC,                                            
  @FACTURA AS doc_interfase,@CODALM AS CODCOS, 'Costo de mercancia vendida factura N° '+trim(@factura)+' cliente: '+trim(@tercero) as Detcoc,                                        
  @codter,@PERIODO AS PERIODO,@codusu,getdate()  ,0.00 AS BASERET                                     
  From  dbo.json_detalle_factura (@DETALLE) dv                                         
  INNER join Inv_Insumos I on I.codins = Dv.codins                            
  inner join con_interfaz_producto cp on trim(cp.Codigo)=trim(i.codigo_interfase)                            
  where left(dv.codins,2) != 'S-'                                      
  GROUP BY cp.Cuenta_Costos                                           
  having  ROUND(SUM(QTYVTA * cosvta),0)>0                                   
  UNION       all                                   
                                         
  Select @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC, cp.Cuenta_Compras as Codcue,                                            
  @FECHA AS FECCOC,0 AS DEBCOC,                                            
  ROUND(SUM(QTYVTA * cosvta),0) as CRECOC,                                            
  @FACTURA AS doc_interfase,@CODALM AS CODCOS, 'Salida de mercancia por venta factura N° '+trim(@factura)+' cliente: '+trim(@tercero) as Detcoc,
  @codter,@PERIODO AS PERIODO,@codusu,getdate()  ,0.00 AS BASERET                                           
  From  dbo.json_detalle_factura (@DETALLE) dv                                         
  INNER join Inv_Insumos I on I.codins = Dv.codins                 
  inner join con_interfaz_producto cp on trim(cp.Codigo)=trim(i.codigo_interfase)                            
  where left(dv.codins,2) != 'S-'                                        
  GROUP BY cp.Cuenta_Compras                
  having  ROUND(SUM(QTYVTA * cosvta),0)>0              
                
   if @valdomicilio >0                                         
   begin                                        
   INSERT INTO @CON_COMPROB(CODCEN,FUECOC,DOCCOC,CODCUE,FECCOC,DEBCOC,CRECOC,doc_interfase,CODCOS,DETCOC,CODTER,PERIODO,CODUSU,fecsys)        
   Select @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC,@Cta_domicilio as Codcue,                                            
   @FECHA AS FECCOC, 0 AS DEBCOC,@valdomicilio as CRECOC,@FACTURA AS doc_interfase,@CODALM AS CODCOS, 'VR.DOMICILIO PRESTADO A:'+@TERCERO as Detcoc,     
   IIF(@tercero_domicilio = '' OR @tercero_domicilio IS NULL OR @TERCERO_DOMICILIO=0,(SELECT TOP 1 NITEMP FROM GEN_EMPRESA),@tercero_domicilio) as Codter,@PERIODO AS PERIODO,@codusu,getdate()                                     
   end;                                            
                                       
     if @valrica >0                                           
   begin                                 
    declare @cuenta  char(8)                             
    select @cuenta = case when cuenta_reteventas ='' or cuenta_reteventas is null then codcue else cuenta_reteventas end from gen_tarifas_ica where codigo in (select codter from con_terceros where codter = @codter )                            
    set @cuenta = case when @cuenta ='' or @cuenta is null then (select cuenta_retencion_ica from gen_parametros_ventas) else @cuenta end                            
                   
    INSERT INTO @CON_COMPROB(CODCEN,FUECOC,DOCCOC,CODCUE,FECCOC,DEBCOC,CRECOC,doc_interfase,CODCOS,DETCOC,CODTER,PERIODO,CODUSU,fecsys)                                                 
    Select @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC,@cuenta as Codcue,                                              
    @FECHA AS FECCOC, @valrica AS DEBCOC,0.00 as CRECOC,@FACTURA AS doc_interfase,@CODALM AS CODCOS, 'Reteica apliacdo A:'+trim(@TERCERO)+'venta factura N° '+trim(@factura) as Detcoc,                                              
    @codter as Codter,@PERIODO AS PERIODO,@codusu,getdate()                                              
   end;                             
                            
  if @valriva >0                                           
   begin                                          
    INSERT INTO @CON_COMPROB(CODCEN,FUECOC,DOCCOC,CODCUE,FECCOC,DEBCOC,CRECOC,doc_interfase,CODCOS,DETCOC,CODTER,PERIODO,CODUSU,fecsys)                                                 
    Select @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC,(select cuenta_retencion_iva from gen_parametros_ventas) as Codcue,                                              
    @FECHA AS FECCOC, @valriva AS DEBCOC,0.00 as CRECOC,@FACTURA AS doc_interfase,@CODALM AS CODCOS, 'Reteiva apliacdo A:'+trim(@TERCERO)+' en venta factura N° '+trim(@factura) as Detcoc,                                
    @codter as Codter,@PERIODO AS PERIODO,@codusu,getdate()                                              
   end;                          
   IF (@anticipo_aplicado > 0)                                              
    BEGIN                                              
  INSERT INTO @CON_COMPROB(CODCEN,FUECOC,DOCCOC,CODCUE,FECCOC,DEBCOC,CRECOC,doc_interfase,CODCOS,DETCOC,CODTER,PERIODO,CODUSU,fecsys)                                          
  Select @CODALM AS CODCEN,@TIPFAC AS FUECOC,@COMPROBANTE AS DOCCOC,(select cuenta_anticipo_clientes from gen_parametros_ventas) as Codcue,                                              
  @FECHA AS FECCOC, @anticipo_aplicado AS DEBCOC,0.00 as CRECOC,@FACTURA AS doc_interfase,@CODALM AS CODCOS, 'Anticipo apliacdo A:'+trim(@TERCERO)+' en venta factura N° '+trim(@factura) as Detcoc,                                              
  @codter as Codter,@PERIODO AS PERIODO,@codusu,getdate()                           
 END;                             
 end                          
 --IF (SELECT SUM(DEBCOC-CRECOC) FROM @CON_COMPROB) !=0 OR (SELECT COUNT(CP.CODCUE) FROM @CON_COMPROB CP LEFT JOIN CON_CUENTAS CC ON CC.CODCUE=CP.CODCUE AND CC.AUXCUE=1 WHERE CC.ID IS NULL) != 0                                       
 --BEGIN                                      
 --  SET @DES =1                                
 --  Raiserror('Comprobante descuadrado%s',16,-1,' ¡Se cancelan todas las transacciones!')                                      
 --END                                      
 --ELSE                                       
 BEGIN                                 
   INSERT INTO CON_COMPROB(CODCEN,FUECOC,DOCCOC,CODCUE,FECCOC,DEBCOC,CRECOC,doc_interfase,CODCOS,DETCOC,CODTER,PERIODO,CODUSU,fecsys,checoc,basret,ORICOC)                                         
   SELECT CODCEN,FUECOC,DOCCOC,CODCUE,FECCOC,DEBCOC,CRECOC,doc_interfase,CODCOS,DETCOC,CODTER,PERIODO,CODUSU,fecsys,CHECOC,BASERET,'VN' FROM @CON_COMPROB                                      
 END                                    
 ---- Registrar ingreso de terceros por domicilios                                        
                                            
  SELECT @valpagado = CASE WHEN @CREDITO>0 tHEN 0 eLSE @CREDITO END                                            
  SELECT @CuentaCaja = CASE WHEN @CREDITO>0 tHEN @CtaCredito eLSE @CuentaCaja END                                            
  select @valcosto =  ROUND(SUM(QTYVTA * cosvta),0) From  dbo.json_detalle_factura (@DETALLE) dv                 
          
  declare @plazo integer                                            
  select @plazo = plazo from con_terceros where codter =@codter                                           
  Select @venfac = @fecha+@plazo                                            
  ----graba en ven_facturas                                             
  BEGIN                             
  SET @total_factura =  @subtotal+@total_iva-(@valrica+@valriva+@valret+@Totdescuento)                            
  select @CuentaCaja = case when @credito>0 then (select cuenta_cartera from gen_parametros_ventas) when @transferencia>0 then @CODcuenta else (select codcue from tes_cuenban where codcba='90'+trim(right(@codalm,2))) end                                  
  
    
   -- En el caso de ComercialRF se asume el campo Placa para guardar el Nº de Orden   
  INSERT  INTO dbo.ven_facturas                                            
  (codalm,numfact,tipfac,fecfac,codter,codven,netfac,abofac,valvta,valiva,                                            
  valotr,valdomicilio,valant,valdcto,valret,valrica,valriva,Retecree,valcosto,venfac,                                            
  efectivo,cheques,credito,TarjetaDB,tarjetaCR,Transferencia,valpagado,estfac,fecsys,codusu,codcue,Observa,doccoc,resolucion_dian,lugar_entrega,placa,CUFE)                                            
  SELECT  @codalm,@factura,@tipfac,@fecha,@codter,@codven,isnull(@total_factura,0),ISNULL(@abofac, 0),@subtotal,                                            
  @total_iva,0,isnull(@valdomicilio,0),ISNULL(@anticipo_aplicado, 0),ISNULL( @Totdescuento, 0),ISNULL(@valret, 0),iSNULL(@valrica, 0),ISNULL(@valriva, 0),0,ISNULL(@valcosto, 0),                                            
  ISNULL(@venfac, @fecha),ISNULL(@efectivo, 0),ISNULL(@cheques, 0),ISNULL(@credito, 0),ISNULL(@tarjetadb, 0),ISNULL(@tarjetacr, 0),isnull(@transferencia,0.00),ISNULL(@valpagado, 0),'',GETDATE(),@codusu,                                            
  @CuentaCaja,@observa, @comprobante,@codigo_dian,@lugar_entrega,@orden, @CUFE ;                                             
    set @id = SCOPE_IDENTITY()                                  
    --- Grabamos el Detalle de la Factura                                            
   begin                                                
   insert into ven_detafact(codalm,tipfact,numfac,numord,fecord,codins,qtyins,devins,valins,ivains,desins,valdescuento,cosins,observa,estfac,undvta,preciound,qtyvta  
   ,CosVta,CODTAR,excedente,factor,id_factura,tasa_reteiva,tasa_reteica,tasa_retencion)                                            
   SELECT  @codalm,@tipfac,@factura,'',CONVERT(VARCHAR(11),getdate(),103),codins,cantidad,0,VALUNITARIO,tasa_iva,                                            
   Tasa_descuento,Valdescuento,costo_unidad,'','',codmedida_vta,preciound,qtyvta,cosvta,@codtar,EXCEDENTE,factor,@id as id_factura,  
   tasa_reteiva,tasa_reteica,tasa_retencion  
   FROM dbo.json_detalle_factura (@DETALLE);                                              
    end                                              
  END;                                 
   ----Si la Factura es Credito generamos el movimiento                                            
  IF ( @credito>0 )                                            
  BEGIN                                              
    INSERT INTO dbo.gen_detalle_movimientos (id_factura,sucursal,tipo_doc_origen , documento_origen , tipo_doc_afectado ,                                       
   documento_afectado , codalm , codter , codcon , cuenta , debito , credito , tasa_iva , tasa_reteica , tasa_retencion , fecha ,                                      
    estado , clase , comprobante,codusuario)                                          
  SELECT @id, @codalm,@tipfac, @factura,@tipfac,@factura,@codalm,@codter,space(1),@CuentaCaja,@credito,0.00,0.00,0.00,@tasaret,@fecha,space(1),2,@COMPROBANTE,@codusu                                      
  END;                                            
                                 
   ---- Factura de Venta de Contado                                            
                                             
    IF (@anticipo_aplicado > 0)                                            
    BEGIN                                            
        UPDATE  ven_maeanticipo                                            
      SET salant = isnull(salant,0.00) - @anticipo_aplicado,aboant = isnull(aboant,0.00) + @anticipo_aplicado                                            
      WHERE   LTRIM(RTRIM(codter)) = RTRIM(LTRIM(@codter)) and codalm=@codalm;                                   
                                          
INSERT INTO dbo.gen_detalle_movimientos (id_factura,sucursal, tipo_doc_origen , documento_origen , tipo_doc_afectado ,                                       
   documento_afectado , codalm , codter , codcon , cuenta , debito , credito , tasa_iva , tasa_reteica , tasa_retencion , fecha ,                                      
    estado , clase ,comprobante, codusuario)                                          
    SELECT @id,@codalm, 'CA',@factura,@tipfac,'00000001',@codalm,@codter,space(1),                                      
    @CuentaCaja,@anticipo_aplicado,0.00,0.00,0.00,@tasaret,@fecha,space(1),2,@COMPROBANTE,@codusu                                             
    END;                                               
                                                       
  ---- Grabamos los cheques y las Tarjetas                                            
  If @cheques>0                                                   
    begin                                                    
  INSERT INTO tes_cheques (Numche,Codban,FecChe,Tipdoc,Valche,Codalm,Codter,Numdoc,Estche,Codusu,Fecsys)                                                  
  select  ltrim(rtrim(cheque)) as Numche,ltrim(rtrim(bco)) as Codban,fecha as FecChe,@tipfac as Tipdoc, valor as Valche,@codalm,@codter,@factura as Numdoc,'P' as Estche,@codusu,sysdatetime() as Fecsys                              
  from VEN_DETALLE_PAGOS(@pagos)                                          
  where formapago  ='CH'                            
     end                                          
                                   
 If (ISNULL(@tarjetadb,0.00)+ISNULL(@tarjetacr,0.00))>0                                             
 begin                           
  BEGIN                                                    
  update tes_tarjetas set codbco=isnull(codbco,''),numdoc = isnull(numdoc,''),valreteica = isnull(VALRETEICA,0),PORCOMIS=ISNULL(PORCOMIS,0)                          
  where year(fecha)>=GETDATE() AND month(fecha)>=MONTH(GETDATE())                          
  END                          
                                                       
  INSERT INTO Tes_Tarjetas(Codalm,Tipdoc,docvta,codbco,numdoc,Fecha,Valtar,Codter,Codusu,Fecsys,CodFranq,TIPTAR)                                                     
  select  @codalm,@tipfac,@factura AS docvta,'90' AS codbco,TRIM(CHEQUE) AS numdoc,Fecha,VALOR AS Valtar,@codter,@codusu,sysdatetime() as Fecsys,LTRIM(RTRIM(FRANQUICIA)) AS CodFranq,                          
  formapago AS TIPTAR                            
  from VEN_DETALLE_PAGOS(@pagos)                                            
  where formapago  in ('TD','TC')                                       
 end;                                          
                                                 
   ---  Actualizamos Datos del Inventario                                                 
   UPDATE  inv_invent SET  caninv = caninv - DV.cantidad                                        
   FROM inv_invent IV                                                 
   INNER JOIN (select @codalm as codalm,codins , sum(cantidad) as cantidad     
    from dbo.json_detalle_factura(@DETALLE)    
    group by codins)dv ON IV.codins=DV.CODINS and IV.codalm = dv.codalm           
   WHERE DV.CANTIDAD > 0                                              
                                    
  begin                                                  
     INSERT  INTO inv_kardex(codalm,codins,tipkar,dockar,feckar,cankar,coskar,venkar,codter,fecsys,codusu,numcom,observa)                                            
      SELECT  @codalm,codins,'SA',@Factura,@fecha,cantidad,ISNULL(dbo.Costo_Producto(@codalm,codins),0),VALUNITARIO,@codter,GETDATE(),@codusu,@Factura,''                                        
   from dbo.json_detalle_factura(@DETALLE)  where left(codins,2) != 'S-'                                        
   end;                                        
                                                               
COMMIT TRAN;                       
select @id as id                                            
END TRY                                            
  BEGIN CATCH
   DECLARE @ERROR VARCHAR(500) = ERROR_MESSAGE();
   IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
   RAISERROR(@ERROR, 16, 1);
 END CATCH 
