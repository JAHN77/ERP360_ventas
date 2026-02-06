import React, { createContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { Usuario, Empresa, Sede } from '../types';
// FIX: Imported all necessary mock data for user session creation.
import { usuarios, empresas as allEmpresas } from '../data/mockData';
import { Role, rolesConfig, Permission } from '../config/rolesConfig';
import apiClient, { fetchBodegas } from '../services/apiClient';
import { logger } from '../utils/logger';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoadingBodegas: boolean;
  user: Usuario | null;
  selectedCompany: Empresa | null;
  selectedSede: Sede | null;
  permissions: Permission[];
  token: string | null;
  bodegas: Sede[];
  loadBodegas: (signal?: AbortSignal) => Promise<void>;
  login: (username: string, password: string, companyId?: number) => Promise<boolean>;
  logout: () => void;
  switchCompany: (companyId: number) => void;
  switchSede: (sedeId: number | string, sedeData?: { codigo?: string; nombre?: string }) => void;
  hasPermission: (permission: Permission) => boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children?: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Empresa | null>(null);
  const [selectedSede, setSelectedSede] = useState<Sede | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [bodegas, setBodegas] = useState<Sede[]>([]);
  const [isLoadingBodegas, setIsLoadingBodegas] = useState(true);

  const isAuthenticated = !!user;

  // Cargar bodega desde localStorage al iniciar (si existe)
  useEffect(() => {
    try {
      const savedSedeId = localStorage.getItem('selectedSedeId');
      const savedSedeData = localStorage.getItem('selectedSedeData');

      if (savedSedeId && savedSedeData) {
        try {
          const sedeData = JSON.parse(savedSedeData);
          // Solo cargar si los datos son válidos
          if (sedeData && sedeData.id && sedeData.codigo) {
            // No establecer aquí, esperar a que se carguen las bodegas para validar
            logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Bodega guardada encontrada en localStorage:', sedeData);
          }
        } catch (parseError) {
          logger.warn({ prefix: 'AuthContext' }, 'Error parseando datos de bodega desde localStorage:', parseError);
          localStorage.removeItem('selectedSedeId');
          localStorage.removeItem('selectedSedeData');
        }
      }
    } catch (error) {
      logger.warn({ prefix: 'AuthContext' }, 'Error accediendo a localStorage:', error);
    }
  }, []);

  // Cargar bodegas desde la base de datos
  const loadBodegas = useCallback(async (signal?: AbortSignal) => {
    try {
      // CRÍTICO: Establecer loading ANTES de cualquier operación
      setIsLoadingBodegas(true);
      logger.log({ prefix: 'AuthContext', level: 'debug' }, '🔄 Iniciando carga de bodegas desde la BD...');

      let response;
      try {
        // Llamar directamente a fetchBodegas - el apiClient ya maneja timeouts (30 segundos)
        // IMPORTANTE: Esperar a que la promesa se resuelva o rechace completamente
        response = await fetchBodegas();
        logger.log({ prefix: 'AuthContext', level: 'debug' }, '✅ Respuesta recibida del backend:', {
          success: response?.success,
          hasData: !!response?.data,
          dataLength: Array.isArray(response?.data) ? response.data.length : 0
        });
      } catch (error) {
        logger.warn({ prefix: 'AuthContext' }, '⚠️ Error al cargar bodegas desde backend:', {
          error: error instanceof Error ? error.message : String(error),
          type: error instanceof Error ? error.constructor.name : typeof error,
          isAbortError: error instanceof Error && error.name === 'AbortError'
        });

        // Si es un error de aborto, no hacer nada más
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        response = {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      // Verificar que la respuesta sea válida y tenga datos
      if (response && response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Mapear bodegas de la BD al formato Sede
        const mappedBodegas = response.data.map((b: any, index: number) => {
          const codigoAlmacenRaw = b.codigo || b.codalm || b.id || '';
          let codigoAlmacen: string;
          if (codigoAlmacenRaw !== null && codigoAlmacenRaw !== undefined) {
            codigoAlmacen = String(codigoAlmacenRaw).trim();
            if (/^\d+$/.test(codigoAlmacen)) {
              codigoAlmacen = codigoAlmacen.padStart(3, '0');
            }
          } else {
            codigoAlmacen = String(index + 1).padStart(3, '0');
          }

          let bodegaId: number;
          if (codigoAlmacen && /^\d+$/.test(codigoAlmacen)) {
            bodegaId = parseInt(codigoAlmacen, 10);
          } else {
            bodegaId = index + 1;
          }

          const nombreBodega = (b.nombre || b.nomalm || '').trim();
          const direccionBodega = (b.direccion || b.diralm || '').trim();
          const ciudadBodega = (b.ciudad || b.ciualm || '').trim();
          const bodegaCodigo = codigoAlmacen;

          return {
            id: bodegaId,
            nombre: nombreBodega,
            codigo: bodegaCodigo,
            empresaId: 1,
            municipioId: 11001,
            direccion: direccionBodega,
            ciudad: ciudadBodega
          };
        });

        setBodegas(mappedBodegas);

        // Lógica de selección automática
        if (mappedBodegas.length === 1) {
          const unicaBodega = mappedBodegas[0];
          setSelectedSede(unicaBodega);
          localStorage.setItem('selectedSedeId', String(unicaBodega.id));
          localStorage.setItem('selectedSedeData', JSON.stringify({
            id: unicaBodega.id,
            nombre: unicaBodega.nombre,
            codigo: unicaBodega.codigo,
            empresaId: unicaBodega.empresaId
          }));
        } else {
          let bodegaCargada = false;
          const savedSedeId = localStorage.getItem('selectedSedeId');
          const savedSedeData = localStorage.getItem('selectedSedeData');

          if (savedSedeId && savedSedeData) {
            try {
              const sedeData = JSON.parse(savedSedeData);
              const bodegaEncontrada = mappedBodegas.find(b =>
                String(b.id) === String(sedeData.id) ||
                String(b.codigo) === String(sedeData.codigo)
              );

              if (bodegaEncontrada) {
                setSelectedSede(bodegaEncontrada);
                bodegaCargada = true;
              }
            } catch (e) { }
          }

          if (!bodegaCargada && mappedBodegas.length > 0) {
            const primeraBodega = mappedBodegas[0];
            setSelectedSede(primeraBodega);
            localStorage.setItem('selectedSedeId', String(primeraBodega.id));
            localStorage.setItem('selectedSedeData', JSON.stringify({
              id: primeraBodega.id,
              nombre: primeraBodega.nombre,
              codigo: primeraBodega.codigo,
              empresaId: primeraBodega.empresaId
            }));
          }
        }
      } else {
        setBodegas([]);
        setSelectedSede(null);
      }
    } catch (error) {
      logger.error({ prefix: 'AuthContext' }, '❌ Error inesperado procesando bodegas:', error);
      setBodegas([]);
      setSelectedSede(null);
    } finally {
      setIsLoadingBodegas(false);
    }
  }, []);

  // Cargar bodegas al montar
  useEffect(() => {
    const abortController = new AbortController();
    loadBodegas(abortController.signal);
    return () => abortController.abort();
  }, [loadBodegas]);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await apiClient.getMe();
      if (response.success && response.data) {
        const userData = response.data.user; // { id, codusu, nomusu, role, firma }

        // Fetch companies from backend
        let userCompanies: Empresa[] = [];
        try {
          const companiesRes = await apiClient.getCompanies();
          if (companiesRes.success && Array.isArray(companiesRes.data)) {
            // FILTER: Force only Orquidea
            const allCompanies = companiesRes.data;
            userCompanies = allCompanies.filter((c: any) =>
              c.db_name === 'orquidea' ||
              c.razonSocial?.toLowerCase().includes('orquidea') ||
              c.id === 1 // Fallback if db_name not set
            );

            if (userCompanies.length === 0 && allCompanies.length > 0) {
              // Fallback safely if Orquidea not found via exact match but list exists
              logger.warn({ prefix: 'AuthContext' }, 'Orquidea company not found strictly, checking strict ID 1 or fallback to first.');
              const fallback = allCompanies.find((c: any) => c.id === 1);
              if (fallback) userCompanies = [fallback];
              else userCompanies = [allCompanies[0]]; // Absolute fallback
            }

            logger.log({ prefix: 'AuthContext', level: 'debug' }, '✅ Empresa Orquidea cargada:', userCompanies.length);
          } else {
            logger.warn({ prefix: 'AuthContext' }, '⚠️ Fallo al cargar empresas, usando mock data');
            userCompanies = allEmpresas.filter(c => c.db_name === 'orquidea' || c.id === 1);
          }
        } catch (e) {
          logger.error({ prefix: 'AuthContext' }, '❌ Error fetching companies:', e);
          userCompanies = allEmpresas.filter(c => c.db_name === 'orquidea' || c.id === 1);
        }

        // Construct Usuario object
        const sedesToUse = bodegas.length > 0 ? bodegas : [];
        const empresasWithSedes = userCompanies.map(e => ({
          ...e,
          sedes: sedesToUse.map(s => ({ ...s, empresaId: e.id }))
        }));

        const userObj: Usuario = {
          id: userData.id,
          email: '', // No email in DB
          username: userData.codusu,
          primerNombre: userData.nomusu.split(' ')[0] || '',
          primerApellido: userData.nomusu.split(' ').slice(1).join(' ') || '',
          nombre: userData.nomusu,
          rol: userData.role as Role || 'vendedor',
          empresas: empresasWithSedes,
          firma: userData.firma
        };

        setUser(userObj);

        // Set Permissions
        const userPermissions = rolesConfig[userObj.rol]?.can || [];
        const isAdmin = userPermissions.includes('*');
        if (isAdmin) {
          const allPermissions = Object.values(rolesConfig).flatMap(r => r.can) as Permission[];
          setPermissions([...new Set(allPermissions.filter(p => p !== '*'))]);
        } else {
          setPermissions(userPermissions as Permission[]);
        }

        // Select Company/Sede Logic (Restore or Default)
        if (userObj.empresas.length > 0) {
          let companyToSelect = null;

          // 1. Force Orquidea Selection
          companyToSelect = userObj.empresas[0]; // Since we filtered list to only Orquidea above

          // 3. Fallback: First available
          if (!companyToSelect) {
            companyToSelect = userObj.empresas[0];
          }

          if (companyToSelect) {
            // CRÍTICO: Evitar actualización de estado si es la misma empresa (previene loop infinito)
            // Comparar por ID
            if (!selectedCompany || selectedCompany.id !== companyToSelect.id) {
              logger.log({ prefix: 'AuthContext', level: 'debug' }, '🔄 Actualizando empresa seleccionada:', companyToSelect.razonSocial);
              setSelectedCompany(companyToSelect);
              localStorage.setItem('selectedCompanyId', String(companyToSelect.id));

              // Lógica de restauración de sede mejorada
              try {
                const savedSedeId = localStorage.getItem('selectedSedeId');
                const savedSedeData = localStorage.getItem('selectedSedeData');
                let sedeToSelect = null;

                if (savedSedeId && companyToSelect.sedes) {
                  sedeToSelect = companyToSelect.sedes.find(s =>
                    String(s.id) === String(savedSedeId) ||
                    (savedSedeData && JSON.parse(savedSedeData).codigo === s.codigo)
                  );
                }

                if (!sedeToSelect && companyToSelect.sedes && companyToSelect.sedes.length > 0) {
                  sedeToSelect = companyToSelect.sedes[0];
                }

                if (sedeToSelect) {
                  setSelectedSede(sedeToSelect);
                  localStorage.setItem('selectedSedeId', String(sedeToSelect.id));
                  localStorage.setItem('selectedSedeData', JSON.stringify({
                    id: sedeToSelect.id,
                    nombre: sedeToSelect.nombre,
                    codigo: sedeToSelect.codigo,
                    empresaId: sedeToSelect.empresaId
                  }));
                }
              } catch (e) {
                logger.error({ prefix: 'AuthContext' }, 'Error restoring sede in refreshUser:', e);
              }
            }
          }
        }
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Auth check failed', error);
      localStorage.removeItem('token');
    }
  }, [bodegas, selectedCompany]); // Mantenemos dependencias pero controlamos la actualización interna


  // Check Auth on Mount
  useEffect(() => {
    if (bodegas.length > 0 || !isLoadingBodegas) {
      refreshUser();
    }
  }, [bodegas, isLoadingBodegas, refreshUser]);

  // Sincronización automática de bodega cuando cambia la empresa
  useEffect(() => {
    if (selectedCompany && !selectedSede) {
      const companySedes = selectedCompany.sedes || [];
      if (companySedes.length > 0) {
        // Intentar recuperar del localStorage primero
        const savedSedeId = localStorage.getItem('selectedSedeId');
        let sedeToSelect = null;

        if (savedSedeId) {
          sedeToSelect = companySedes.find(s => String(s.id) === String(savedSedeId));
        }

        // Si no hay guardada o no coincide, usar la primera
        if (!sedeToSelect) {
          sedeToSelect = companySedes[0];
        }

        if (sedeToSelect) {
          logger.log({ prefix: 'AuthContext', level: 'debug' }, '🔄 Sincronización automática: Seleccionando bodega', sedeToSelect.nombre);
          setSelectedSede(sedeToSelect);
          localStorage.setItem('selectedSedeId', String(sedeToSelect.id));
          localStorage.setItem('selectedSedeData', JSON.stringify({
            id: sedeToSelect.id,
            nombre: sedeToSelect.nombre,
            codigo: sedeToSelect.codigo,
            empresaId: sedeToSelect.empresaId
          }));
        }
      }
    }
  }, [selectedCompany, selectedSede]);

  const login = async (username: string, password: string, companyId?: number): Promise<boolean> => {
    try {
      const response = await apiClient.login(username, password, companyId);

      if (response.success && response.data) {
        const { token, user: userData } = response.data;
        if (token) {
          localStorage.setItem('token', token);
          // CRÍTICO: Cargar bodegas inmediatamente después de obtener el token
          await loadBodegas();
        }

        // Construct User
        const sedesToUse = bodegas.length > 0 ? bodegas : [];
        const empresasWithSedes = allEmpresas.map(e => ({
          ...e,
          sedes: sedesToUse.map(s => ({ ...s, empresaId: e.id }))
        }));

        const fullName = userData.nomusu || username;

        const userObj: Usuario = {
          id: userData.id,
          email: '',
          username: userData.codusu,
          primerNombre: fullName.split(' ')[0] || '',
          primerApellido: fullName.split(' ').slice(1).join(' ') || '',
          nombre: fullName,
          rol: userData.role as Role || 'vendedor',
          empresas: empresasWithSedes,
          firma: userData.firma
        };

        setUser(userObj);

        // Permissions
        const userPermissions = rolesConfig[userObj.rol]?.can || [];
        const isAdmin = userPermissions.includes('*');
        if (isAdmin) {
          const allPermissions = Object.values(rolesConfig).flatMap(r => r.can) as Permission[];
          setPermissions([...new Set(allPermissions.filter(p => p !== '*'))]);
        } else {
          setPermissions(userPermissions as Permission[]);
        }

        if (userObj.empresas.length > 0) {
          const firstCompany = userObj.empresas[0];
          setSelectedCompany(firstCompany);
          localStorage.setItem('selectedCompanyId', String(firstCompany.id));

          if (firstCompany.sedes && firstCompany.sedes.length > 0) {
            const defaultSede = firstCompany.sedes[0];
            setSelectedSede(defaultSede);
            localStorage.setItem('selectedSedeId', String(defaultSede.id));
          } else {
            setSelectedSede(null);
            localStorage.removeItem('selectedSedeId');
          }
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setSelectedCompany(null);
    setSelectedSede(null);
    setPermissions([]);
  };

  const switchCompany = async (companyId: number) => {
    const company = user?.empresas.find(e => e.id === companyId);
    if (company) {
      try {
        logger.log({ prefix: 'AuthContext', level: 'info' }, `Switching to company: ${company.razonSocial} (ID: ${companyId})`);

        // 1. Call API to get new token for the target company
        // For Single Company (Orquidea), this prevents switching to others even if triggered
        if (company.db_name !== 'orquidea' && company.id !== 1) {
          console.warn("Attempted to switch to non-Orquidea company in Single-Company mode.");
          return;
        }

        const response = await apiClient.switchCompany(companyId);

        if (response.success && response.data && response.data.token) {
          logger.log({ prefix: 'AuthContext', level: 'info' }, '✅ Token updated for new company');

          // 2. Update token in localStorage
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('selectedCompanyId', String(companyId));

          // 3. Update Selected Company
          setSelectedCompany(company);

          // 4. Handle Sede selection (Local logic)
          if (company.sedes && company.sedes.length > 0) {
            const defaultSede = company.sedes[0];
            setSelectedSede(defaultSede);
            try {
              localStorage.setItem('selectedSedeId', String(defaultSede.id));
              localStorage.setItem('selectedSedeData', JSON.stringify({
                id: defaultSede.id,
                nombre: defaultSede.nombre,
                codigo: defaultSede.codigo,
                empresaId: defaultSede.empresaId
              }));
            } catch (error) { }
          } else {
            setSelectedSede(null);
            try {
              localStorage.removeItem('selectedSedeId');
              localStorage.removeItem('selectedSedeData');
            } catch (error) { }
          }

          // 5. Update local state for Sede and Company is already done
          // The router will handle the URL change and the context update will trigger re-renders
          logger.log({ prefix: 'AuthContext', level: 'info' }, '✅ Company switch completed without reload');
        } else {
          logger.error({ prefix: 'AuthContext' }, '❌ Failed to switch company token:', response.message);
          // Fallback: Just update local state (legacy behavior) - but warn user
          // alert('Error al cambiar de empresa. Por favor cierre sesión e intente nuevamente.');
        }
      } catch (error) {
        logger.error({ prefix: 'AuthContext' }, '❌ Error switching company:', error);
        alert('Error de conexión al cambiar de empresa.');
      }
    }
  };

  const switchSede = useCallback((sedeId: number | string, sedeData?: { codigo?: string; nombre?: string }) => {
    logger.log({ prefix: 'AuthContext', level: 'debug' }, 'switchSede llamado con ID:', sedeId, 'Tipo:', typeof sedeId, 'Datos adicionales:', sedeData);
    logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Sedes disponibles:', selectedCompany?.sedes?.map(s => ({ id: s.id, codigo: s.codigo, nombre: s.nombre })));

    if (selectedCompany) {
      // Normalizar el ID a número si es posible, o mantener como string
      const sedeIdNum = typeof sedeId === 'string' ? (isNaN(Number(sedeId)) ? null : Number(sedeId)) : sedeId;
      const sedeIdStr = String(sedeId).trim();

      let sede: Sede | undefined;

      // PRIORIDAD 1: Buscar por código si está disponible (más confiable que el ID)
      if (sedeData?.codigo) {
        const codigoBuscado = String(sedeData.codigo).trim();
        // Normalizar código para comparación flexible - múltiples formatos
        const codigoBuscadoNormalizado = codigoBuscado.replace(/^0+/, '') || '0';
        const codigoBuscadoFormateado = /^\d+$/.test(codigoBuscadoNormalizado) ? codigoBuscadoNormalizado.padStart(3, '0') : codigoBuscado;

        logger.log({ prefix: 'AuthContext', level: 'debug' }, '🔍 Buscando por código:', {
          codigoBuscado,
          codigoBuscadoNormalizado,
          codigoBuscadoFormateado,
          sedesDisponibles: selectedCompany.sedes?.map(s => ({ id: s.id, codigo: s.codigo, nombre: s.nombre }))
        });

        sede = selectedCompany.sedes?.find(s => {
          if (!s?.codigo) return false;
          const codigoSede = String(s.codigo).trim();
          const codigoSedeNormalizado = codigoSede.replace(/^0+/, '') || '0';
          const codigoSedeFormateado = /^\d+$/.test(codigoSedeNormalizado) ? codigoSedeNormalizado.padStart(3, '0') : codigoSede;

          // Comparar códigos de múltiples formas
          const match = codigoSede === codigoBuscado ||
            codigoSede === codigoBuscadoFormateado ||
            codigoSedeFormateado === codigoBuscadoFormateado ||
            codigoSedeNormalizado === codigoBuscadoNormalizado ||
            codigoSede.toUpperCase() === codigoBuscado.toUpperCase() ||
            String(codigoSede).padStart(3, '0') === String(codigoBuscado).padStart(3, '0');

          if (match) {
            logger.log({ prefix: 'AuthContext', level: 'debug' }, `✅ Coincidencia de código encontrada:`, {
              codigoSede,
              codigoBuscado,
              sede: { id: s.id, codigo: s.codigo, nombre: s.nombre }
            });
          }

          return match;
        });
        if (sede) {
          logger.log({ prefix: 'AuthContext', level: 'debug' }, '✅ Sede encontrada por código:', sede);
        } else {
          logger.warn({ prefix: 'AuthContext' }, '⚠️ No se encontró sede por código:', codigoBuscado);
        }
      }

      // PRIORIDAD 2: Si no se encuentra por código, buscar por ID (numérico o string)
      if (!sede) {
        sede = selectedCompany.sedes?.find(s => {
          // Comparar como número si ambos son números
          if (sedeIdNum !== null && typeof s.id === 'number') {
            const found = s.id === sedeIdNum;
            if (found) {
              logger.log({ prefix: 'AuthContext', level: 'debug' }, `✅ Coincidencia numérica: s.id (${s.id}) === sedeIdNum (${sedeIdNum})`);
            }
            return found;
          }
          // Comparar como string
          const found = String(s.id) === sedeIdStr || String(s.id).trim() === sedeIdStr;
          if (found) {
            logger.log({ prefix: 'AuthContext', level: 'debug' }, `✅ Coincidencia string: s.id (${String(s.id)}) === sedeIdStr (${sedeIdStr})`);
          }
          return found;
        });
        if (sede) {
          logger.log({ prefix: 'AuthContext', level: 'debug' }, '✅ Sede encontrada por ID:', sede);
        }
      }

      // PRIORIDAD 3: Si aún no se encuentra y el ID es numérico, intentar buscar por código formateado del ID
      if (!sede && sedeIdNum !== null) {
        const codigoFormateado = String(sedeIdNum).padStart(3, '0');
        sede = selectedCompany.sedes?.find(s => {
          if (!s?.codigo) return false;
          const codigoSede = String(s.codigo).trim();
          const codigoSedeNormalizado = codigoSede.replace(/^0+/, '') || '0';
          return codigoSede === codigoFormateado ||
            codigoSedeNormalizado === String(sedeIdNum);
        });
        if (sede) {
          logger.log({ prefix: 'AuthContext', level: 'debug' }, '✅ Sede encontrada por código formateado del ID:', sede);
        }
      }

      // 3. Si aún no se encuentra, buscar por nombre si está disponible
      if (!sede && sedeData?.nombre) {
        const nombreBuscado = sedeData.nombre.trim().toUpperCase();
        sede = selectedCompany.sedes?.find(s => {
          if (!s?.nombre) return false;
          const nombreSede = s.nombre.trim().toUpperCase();
          return nombreSede === nombreBuscado;
        });
        if (sede) {
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Sede encontrada por nombre:', sede);
        }
      }

      // 4. Si aún no se encuentra, buscar en todas las bodegas cargadas (no solo las de la empresa)
      if (!sede && (sedeData?.codigo || sedeData?.nombre)) {
        const bodegaEncontrada = bodegas.find(b => {
          if (sedeData?.codigo) {
            const codigoBuscado = String(sedeData.codigo).trim().toUpperCase();
            const codigoBodega = String(b.codigo || '').trim().toUpperCase();
            if (codigoBodega === codigoBuscado) return true;
          }
          if (sedeData?.nombre) {
            const nombreBuscado = sedeData.nombre.trim().toUpperCase();
            const nombreBodega = String(b.nombre || '').trim().toUpperCase();
            if (nombreBodega === nombreBuscado) return true;
          }
          return false;
        });

        if (bodegaEncontrada) {
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Bodega encontrada en lista global, creando sede:', bodegaEncontrada);
          // Crear una sede temporal con los datos de la bodega encontrada
          sede = {
            ...bodegaEncontrada,
            empresaId: selectedCompany.id
          };
        }
      }

      // PRIORIDAD 4: Si aún no se encuentra, intentar por índice (último recurso)
      if (!sede && sedeIdNum !== null && sedeIdNum > 0 && sedeIdNum <= (selectedCompany.sedes?.length || 0)) {
        const sedeByIndex = selectedCompany.sedes?.[sedeIdNum - 1];
        // Verificar tanto por ID numérico como por código formateado
        if (sedeByIndex) {
          const codigoFormateado = String(sedeIdNum).padStart(3, '0');
          if (sedeByIndex.id === sedeIdNum || String(sedeByIndex.codigo).trim() === codigoFormateado) {
            logger.log({ prefix: 'AuthContext', level: 'debug' }, '✅ Sede encontrada por índice:', sedeByIndex);
            sede = sedeByIndex;
          }
        }
      }

      if (sede) {
        // Actualizar la sede con los datos proporcionados si están disponibles
        // Esto asegura que el nombre mostrado sea el correcto (ej: "Bodega Norte", "Bodega Sur")
        // CRÍTICO: Asegurar que el código se preserve como string con formato correcto
        let codigoActualizado: string;
        if (sedeData?.codigo) {
          // Si se proporciona código en sedeData, usarlo y asegurar formato
          const codigoRaw = String(sedeData.codigo).trim();
          codigoActualizado = /^\d+$/.test(codigoRaw) ? codigoRaw.padStart(3, '0') : codigoRaw;
        } else if (sede.codigo) {
          // Si hay código en la sede original, preservarlo
          const codigoRaw = String(sede.codigo).trim();
          codigoActualizado = /^\d+$/.test(codigoRaw) ? codigoRaw.padStart(3, '0') : codigoRaw;
        } else {
          // Si no hay código, usar el ID formateado como código
          codigoActualizado = String(sede.id).padStart(3, '0');
        }

        const sedeActualizada: Sede = {
          ...sede,
          // Si se proporciona nombre en sedeData, usarlo (prioridad)
          nombre: sedeData?.nombre || sede.nombre,
          // CRÍTICO: Usar el código preservado/formateado correctamente
          codigo: codigoActualizado
        };

        logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Sede encontrada y actualizada:', {
          id: sedeActualizada.id,
          nombre: sedeActualizada.nombre,
          codigo: sedeActualizada.codigo,
          empresaId: sedeActualizada.empresaId,
          nombreOriginal: sede.nombre,
          nombreActualizado: sedeData?.nombre
        });

        // Asegurar que solo esta sede esté seleccionada (limpiar cualquier otra selección)
        // Actualizar el estado inmediatamente con la sede actualizada
        setSelectedSede(sedeActualizada);

        // Guardar en localStorage para persistencia
        try {
          localStorage.setItem('selectedSedeId', String(sedeActualizada.id));
          localStorage.setItem('selectedSedeData', JSON.stringify({
            id: sedeActualizada.id,
            nombre: sedeActualizada.nombre,
            codigo: sedeActualizada.codigo,
            empresaId: sedeActualizada.empresaId
          }));
        } catch (error) {
          logger.warn({ prefix: 'AuthContext' }, 'No se pudo guardar en localStorage:', error);
        }
      } else {
        logger.warn({ prefix: 'AuthContext' }, 'Sede no encontrada con ID:', sedeId);
        logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Sedes disponibles:', selectedCompany.sedes?.map(s => ({
          id: s.id,
          nombre: s.nombre,
          codigo: s.codigo
        })));
        logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Datos adicionales proporcionados:', sedeData);
        setSelectedSede(null);
        // Limpiar localStorage si no se encuentra
        try {
          localStorage.removeItem('selectedSedeId');
          localStorage.removeItem('selectedSedeData');
        } catch (error) {
          // Ignorar errores de localStorage
        }
      }
    } else {
      logger.warn({ prefix: 'AuthContext' }, 'No hay empresa seleccionada');
      setSelectedSede(null);
    }
  }, [selectedCompany, bodegas]);

  const hasPermission = (permission: Permission): boolean => {
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  };


  const value = useMemo(() => ({
    isAuthenticated,
    isLoadingBodegas,
    user,
    selectedCompany,
    selectedSede,
    permissions,
    token: localStorage.getItem('token'),
    bodegas,
    loadBodegas,
    login,
    logout,
    // FIX: Removed incorrect wrapper functions that caused a type mismatch with AuthContextType. The original functions are now passed directly.
    switchCompany,
    switchSede,
    hasPermission,
    refreshUser,
  }), [isAuthenticated, isLoadingBodegas, user, selectedCompany, selectedSede, permissions, refreshUser, bodegas, loadBodegas]);


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
