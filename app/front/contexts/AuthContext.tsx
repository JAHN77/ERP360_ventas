import React, { createContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { Usuario, Empresa, Sede } from '../types';
// FIX: Imported all necessary mock data for user session creation.
import { usuarios, empresas as allEmpresas, sedes as allSedes } from '../data/mockData';
import { Role, rolesConfig, Permission } from '../config/rolesConfig';
import { fetchBodegas } from '../services/apiClient';
import { logger } from '../utils/logger';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoadingBodegas: boolean;
  user: Usuario | null;
  selectedCompany: Empresa | null;
  selectedSede: Sede | null;
  permissions: Permission[];
  login: (email: string, role: Role) => boolean;
  logout: () => void;
  switchCompany: (companyId: number) => void;
  switchSede: (sedeId: number, sedeData?: { codigo?: string; nombre?: string }) => void;
  hasPermission: (permission: Permission) => boolean;
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

  // Cargar bodegas desde la base de datos
  useEffect(() => {
    const loadBodegas = async () => {
      try {
        setIsLoadingBodegas(true);
        logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Cargando bodegas desde la BD...');
        
        let response;
        try {
          response = await fetchBodegas();
        } catch (fetchError) {
          logger.warn({ prefix: 'AuthContext' }, 'Error de red al cargar bodegas (backend puede no estar disponible):', fetchError);
          // Si hay error de red, usar datos mock
          response = { success: false, data: [] };
        }
        
        logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Respuesta bodegas:', response);
        
        // Verificar que la respuesta sea válida y tenga datos
        if (response && response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
          // Mapear bodegas de la BD al formato Sede
          // El backend ahora devuelve: id (codalm), codigo (codalm), nombre (nomalm), direccion (diralm), ciudad (ciualm)
          const mappedBodegas = response.data.map((b: any, index: number) => {
            // El código viene directamente desde la BD (codalm)
            const codigoAlmacen = String(b.codigo || b.codalm || b.id || '').trim();
            
            // Convertir código a número para el ID si es posible (ej: "001" -> 1, "002" -> 2)
            // Si no es numérico, usar el índice + 1
            let bodegaId: number;
            if (codigoAlmacen && /^\d+$/.test(codigoAlmacen)) {
              bodegaId = parseInt(codigoAlmacen, 10);
            } else {
              bodegaId = index + 1;
            }
            
            const nombreBodega = (b.nombre || b.nomalm || '').trim();
            const direccionBodega = (b.direccion || b.diralm || '').trim();
            const ciudadBodega = (b.ciudad || b.ciualm || '').trim();
            
            // Usar el código directamente de la BD (ya viene formateado)
            const bodegaCodigo = codigoAlmacen.padStart(3, '0');
            
            logger.log({ prefix: 'AuthContext', level: 'debug' }, `Mapeando bodega: ${nombreBodega} (${bodegaCodigo})`);
            
            return {
              id: bodegaId, // ID numérico para compatibilidad
              nombre: nombreBodega,
              codigo: bodegaCodigo, // Código del almacén desde BD (codalm)
              empresaId: 1, // Por defecto asignar a la empresa principal
              municipioId: 11001, // Bogotá por defecto
              direccion: direccionBodega,
              ciudad: ciudadBodega
            };
          });
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Bodegas mapeadas con códigos asignados:', mappedBodegas.map(b => ({
            nombre: b.nombre,
            codigo: b.codigo,
            id: b.id
          })));
          setBodegas(mappedBodegas);
          
          // NO preseleccionar ninguna bodega - el usuario debe elegir manualmente
          // Limpiar cualquier selección previa
          setSelectedSede(null);
          try {
            localStorage.removeItem('selectedSedeId');
            localStorage.removeItem('selectedSedeData');
          } catch (error) {
            logger.warn({ prefix: 'AuthContext' }, 'No se pudo limpiar localStorage:', error);
          }
          
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Bodegas cargadas desde BD. Usuario debe seleccionar una bodega manualmente.');
        } else {
          // Si no hay datos o la respuesta no fue exitosa, usar datos mock como fallback
          const reason = !response ? 'Sin respuesta' : !response.success ? 'Respuesta no exitosa' : !response.data ? 'Sin datos' : 'Array vacío';
          logger.warn({ prefix: 'AuthContext' }, `Sin datos de bodegas desde BD (${reason}), usando datos mock como fallback`);
          setBodegas(allSedes);
          
          // NO preseleccionar ninguna bodega - el usuario debe elegir manualmente
          setSelectedSede(null);
          try {
            localStorage.removeItem('selectedSedeId');
            localStorage.removeItem('selectedSedeData');
          } catch (error) {
            logger.warn({ prefix: 'AuthContext' }, 'No se pudo limpiar localStorage (mock):', error);
          }
          
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Bodegas mock cargadas como fallback. Usuario debe seleccionar una bodega manualmente.');
        }
      } catch (error) {
        logger.error({ prefix: 'AuthContext' }, 'Error cargando bodegas:', error);
        // Fallback a datos mock en caso de error
        setBodegas(allSedes);
        
        // NO preseleccionar ninguna bodega - el usuario debe elegir manualmente
        setSelectedSede(null);
        try {
          localStorage.removeItem('selectedSedeId');
          localStorage.removeItem('selectedSedeData');
        } catch (localError) {
          logger.warn({ prefix: 'AuthContext' }, 'No se pudo limpiar localStorage (mock - error):', localError);
        }
        
        logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Bodegas mock cargadas (error). Usuario debe seleccionar una bodega manualmente.');
      } finally {
        setIsLoadingBodegas(false);
      }
    };
    loadBodegas();
  }, []);

  const login = (email: string, role: Role) => {
    const foundUser = usuarios.find(u => u.email === email);
    if (foundUser) {
      // Usar bodegas de la BD si están disponibles, sino usar mock
      const sedesToUse = bodegas.length > 0 ? bodegas : allSedes;
      logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Login - bodegas estado:', bodegas);
      logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Login - bodegas.length:', bodegas.length);
      logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Login - sedesToUse:', sedesToUse);
      // Asignar todas las bodegas a todas las empresas (ya que las bodegas son compartidas)
      const empresasWithSedes = allEmpresas.map(e => ({
          ...e,
          sedes: sedesToUse.map(s => ({ ...s, empresaId: e.id })) // Asignar todas las bodegas a cada empresa
      }));
      logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Login - empresasWithSedes:', empresasWithSedes);
      logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Login - empresasWithSedes[0].sedes:', empresasWithSedes[0]?.sedes);
      const nombreCompleto = `${foundUser.primerNombre} ${foundUser.primerApellido}`.trim();
      const userWithRole: Usuario = { 
        ...foundUser, 
        rol: role, 
        empresas: empresasWithSedes,
        nombre: nombreCompleto 
      };
      setUser(userWithRole);
      
      const userPermissions = rolesConfig[role]?.can || [];
      const isAdmin = userPermissions.includes('*');
      
      if (isAdmin) {
          const allPermissions = Object.values(rolesConfig).flatMap(r => r.can) as Permission[];
          setPermissions([...new Set(allPermissions.filter(p => p !== '*'))]);
      } else {
          setPermissions(userPermissions as Permission[]);
      }

      if (userWithRole.empresas.length > 0) {
        const firstCompany = userWithRole.empresas[0];
        setSelectedCompany(firstCompany);
        
        // NO preseleccionar ninguna bodega - el usuario debe elegir manualmente
        setSelectedSede(null);
        try {
          localStorage.removeItem('selectedSedeId');
          localStorage.removeItem('selectedSedeData');
        } catch (error) {
          logger.warn({ prefix: 'AuthContext' }, 'No se pudo limpiar localStorage en login:', error);
        }
        
        logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Login exitoso. Usuario debe seleccionar una bodega manualmente.');
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setSelectedCompany(null);
    setSelectedSede(null);
    setPermissions([]);
  };

  const switchCompany = (companyId: number) => {
    const company = user?.empresas.find(e => e.id === companyId);
    if (company) {
      setSelectedCompany(company);
      // NO preseleccionar ninguna bodega - el usuario debe elegir manualmente
      // Limpiar cualquier selección previa
      setSelectedSede(null);
      try {
        localStorage.removeItem('selectedSedeId');
        localStorage.removeItem('selectedSedeData');
      } catch (error) {
        logger.warn({ prefix: 'AuthContext' }, 'No se pudo limpiar localStorage en switchCompany:', error);
      }
      
      logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Empresa cambiada. Usuario debe seleccionar una bodega manualmente.');
    }
  };

  const switchSede = (sedeId: number, sedeData?: { codigo?: string; nombre?: string }) => {
    logger.log({ prefix: 'AuthContext', level: 'debug' }, 'switchSede llamado con ID:', sedeId, 'Datos adicionales:', sedeData);
    if (selectedCompany) {
      // 1. Buscar la sede por ID exacto (más confiable)
      let sede = selectedCompany.sedes?.find(s => s.id === sedeId);
      
      // 2. Si no se encuentra por ID, buscar por código si está disponible
      if (!sede && sedeData?.codigo) {
        const codigoBuscado = String(sedeData.codigo).trim().toUpperCase();
        sede = selectedCompany.sedes?.find(s => {
          if (!s?.codigo) return false;
          const codigoSede = String(s.codigo).trim().toUpperCase();
          return codigoSede === codigoBuscado;
        });
        if (sede) {
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Sede encontrada por código:', sede);
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
      
      // 5. Si aún no se encuentra, intentar por índice (último recurso)
      if (!sede && sedeId > 0 && sedeId <= (selectedCompany.sedes?.length || 0)) {
        const sedeByIndex = selectedCompany.sedes?.[sedeId - 1];
        if (sedeByIndex && sedeByIndex.id === sedeId) {
          // Solo usar si el ID coincide con el índice (caso especial)
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Sede encontrada por índice coincidente:', sedeByIndex);
          sede = sedeByIndex;
        }
      }
      
      if (sede) {
        // Actualizar la sede con los datos proporcionados si están disponibles
        // Esto asegura que el nombre mostrado sea el correcto (ej: "Bodega Norte", "Bodega Sur")
        const sedeActualizada: Sede = {
          ...sede,
          // Si se proporciona nombre en sedeData, usarlo (prioridad)
          nombre: sedeData?.nombre || sede.nombre,
          // Si se proporciona código en sedeData, usarlo (prioridad)
          codigo: sedeData?.codigo || sede.codigo
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
  };

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
    login,
    logout,
    // FIX: Removed incorrect wrapper functions that caused a type mismatch with AuthContextType. The original functions are now passed directly.
    switchCompany,
    switchSede,
    hasPermission,
  }), [isAuthenticated, isLoadingBodegas, user, selectedCompany, selectedSede, permissions]);


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
