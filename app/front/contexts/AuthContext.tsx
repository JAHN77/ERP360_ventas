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
        const response = await fetchBodegas();
        logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Respuesta bodegas:', response);
        if (response.success && response.data && Array.isArray(response.data)) {
          // Función para asignar código según el nombre de la bodega
          const asignarCodigoPorNombre = (nombre: string): string | null => {
            const nombreNormalizado = nombre.trim().toUpperCase();
            
            // Mapeo: 001 = Bodega Principal, 002 = Bodega Norte, 003 = Bodega Sur
            if (nombreNormalizado.includes('PRINCIPAL')) {
              return '001';
            } else if (nombreNormalizado.includes('NORTE')) {
              return '002';
            } else if (nombreNormalizado.includes('SUR')) {
              return '003';
            }
            
            // Si no coincide con ninguno, retornar null para usar el código original
            return null;
          };
          
          // Mapear bodegas de la BD al formato Sede
          // Usar el id de la BD si está disponible, sino usar índice + 1
          const mappedBodegas = response.data.map((b: any, index: number) => {
            // El id viene como string desde la BD, convertirlo a número si es posible
            const bodegaId = typeof b.id === 'string' ? parseInt(b.id, 10) : (b.id || index + 1);
            const nombreBodega = (b.nombre || '').trim();
            
            // Asignar código según el nombre de la bodega
            let bodegaCodigo = asignarCodigoPorNombre(nombreBodega);
            
            // Si no se asignó código por nombre, usar el original o generar uno
            if (!bodegaCodigo) {
              bodegaCodigo = b.codigo || b.id || String(index + 1).padStart(3, '0');
            }
            
            // Asegurar que el código tenga formato de 3 dígitos
            bodegaCodigo = String(bodegaCodigo).padStart(3, '0');
            
            return {
              id: isNaN(bodegaId) ? index + 1 : bodegaId, // Asegurar ID numérico válido
              nombre: nombreBodega,
              codigo: bodegaCodigo, // Código asignado según el nombre
              empresaId: 1, // Por defecto asignar a la empresa principal
              municipioId: 11001, // Bogotá por defecto
              direccion: b.direccion || '',
              ciudad: b.ciudad || ''
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
          
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Bodegas cargadas. Usuario debe seleccionar una bodega manualmente.');
        } else {
          logger.warn({ prefix: 'AuthContext' }, 'Sin datos de bodegas, usando mock');
          setBodegas(allSedes);
          
          // NO preseleccionar ninguna bodega - el usuario debe elegir manualmente
          setSelectedSede(null);
          try {
            localStorage.removeItem('selectedSedeId');
            localStorage.removeItem('selectedSedeData');
          } catch (error) {
            logger.warn({ prefix: 'AuthContext' }, 'No se pudo limpiar localStorage (mock):', error);
          }
          
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Bodegas mock cargadas. Usuario debe seleccionar una bodega manualmente.');
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
      const empresasWithSedes = allEmpresas.map(e => ({
          ...e,
          sedes: sedesToUse.filter(s => s.empresaId === e.id)
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
      
      // 4. Si aún no se encuentra, intentar por índice (último recurso)
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
        // 5. Si aún no se encuentra pero tenemos datos suficientes, crear una nueva sede temporal
        if (sedeData && sedeData.nombre && sedeId) {
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Sede no encontrada en selectedCompany.sedes, creando nueva sede con datos proporcionados');
          const nuevaSede: Sede = {
            id: sedeId,
            nombre: sedeData.nombre,
            codigo: sedeData.codigo || String(sedeId).padStart(3, '0'),
            empresaId: selectedCompany.id,
            municipioId: 11001
          };
          
          // Agregar la nueva sede a selectedCompany.sedes para futuras búsquedas
          if (!selectedCompany.sedes) {
            selectedCompany.sedes = [];
          }
          // Verificar si no existe ya antes de agregar
          const exists = selectedCompany.sedes.some(s => s.id === sedeId);
          if (!exists) {
            selectedCompany.sedes.push(nuevaSede);
            logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Nueva sede agregada a selectedCompany.sedes');
          }
          
          // Establecer la nueva sede como seleccionada
          setSelectedSede(nuevaSede);
          
          // Guardar en localStorage
          try {
            localStorage.setItem('selectedSedeId', String(nuevaSede.id));
            localStorage.setItem('selectedSedeData', JSON.stringify({
              id: nuevaSede.id,
              nombre: nuevaSede.nombre,
              codigo: nuevaSede.codigo,
              empresaId: nuevaSede.empresaId
            }));
          } catch (error) {
            logger.warn({ prefix: 'AuthContext' }, 'No se pudo guardar en localStorage:', error);
          }
        } else {
          logger.warn({ prefix: 'AuthContext' }, 'Sede no encontrada y sin datos suficientes para crear. ID:', sedeId, 'Datos:', sedeData);
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Sedes disponibles:', selectedCompany.sedes?.map(s => ({
            id: s.id,
            nombre: s.nombre,
            codigo: s.codigo
          })));
          logger.log({ prefix: 'AuthContext', level: 'debug' }, 'Datos adicionales proporcionados:', sedeData);
          // Solo limpiar si no hay datos suficientes
          if (!sedeData || !sedeData.nombre) {
            setSelectedSede(null);
            // Limpiar localStorage solo si no hay datos suficientes
            try {
              localStorage.removeItem('selectedSedeId');
              localStorage.removeItem('selectedSedeData');
            } catch (error) {
              // Ignorar errores de localStorage
            }
          }
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
