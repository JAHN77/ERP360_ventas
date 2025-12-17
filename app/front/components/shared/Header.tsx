import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationDropdown from '../notifications/NotificationDropdown';
import { useData } from '../../hooks/useData';
import { GlobalSearchResults as SearchResultsType } from '../../types';
import GlobalSearchResults from '../search/GlobalSearchResults';
import { useNavigation } from '../../hooks/useNavigation';
import { fetchBodegas } from '../../services/apiClient';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { logger } from '../../utils/logger';

// Debounce hook
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};


interface HeaderProps {
  setIsSidebarOpen: (isOpen: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ setIsSidebarOpen }) => {
  const { user, selectedCompany, switchCompany, logout, selectedSede, switchSede, isLoadingBodegas } = useAuth();
  const { theme } = useTheme();
  const { setPage } = useNavigation();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isSedePopoverOpen, setIsSedePopoverOpen] = useState(false);
  const [bodegasDisponibles, setBodegasDisponibles] = useState<any[]>([]);
  const [isLoadingBodegasLocal, setIsLoadingBodegasLocal] = useState(false);
  const bodegasDropdownRef = useRef<HTMLDivElement>(null);
  const bodegasPopoverRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationPopoverRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const userPopoverRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuPopoverRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, markAllAsRead, handleNotificationClick } = useNotifications();
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);

  // --- Global Search State ---
  // useData() debe estar disponible porque Header está dentro de DataProvider en index.tsx
  const { globalSearch } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultsType | null>(null);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // ✅ Custom hooks para manejar clicks fuera y tecla Escape
  useClickOutside(searchRef, () => setIsResultsOpen(false));
  useClickOutside(bodegasDropdownRef, () => setIsSedePopoverOpen(false));
  useClickOutside(notificationRef, () => setNotificationDropdownOpen(false));
  useClickOutside(userDropdownRef, () => setUserDropdownOpen(false));
  useClickOutside(moreMenuRef, () => setIsMoreMenuOpen(false));

  // Cerrar todos los dropdowns con Escape
  useEscapeKey(() => {
    setIsSedePopoverOpen(false);
    setIsMobileSearchOpen(false);
    setIsMoreMenuOpen(false);
    setUserDropdownOpen(false);
    setNotificationDropdownOpen(false);
    setIsResultsOpen(false);
  });

  // Protección: No renderizar hasta que los datos críticos estén disponibles
  if (!user || !selectedCompany) {
    return (
      <header className="sticky top-0 z-40 flex justify-between items-center px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3 md:py-4 bg-white/90 dark:bg-slate-800/90 supports-[backdrop-filter]:backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-center w-full">
          <div className="flex items-center gap-2">
            <i className="fas fa-spinner fa-spin text-slate-500"></i>
            <span className="text-sm text-slate-500 dark:text-slate-400">Cargando...</span>
          </div>
        </div>
      </header>
    );
  }

  useEffect(() => {
    const search = () => {
      // Protección defensiva: verificar que debouncedSearchTerm sea string
      const searchValue = String(debouncedSearchTerm || '').trim();

      if (searchValue.length > 1 && typeof globalSearch === 'function') {
        try {
          const results = globalSearch(searchValue);

          // Verificar que los resultados sean válidos
          if (results && typeof results === 'object') {
            const totalResults =
              (results.cotizaciones?.length || 0) +
              (results.pedidos?.length || 0) +
              (results.facturas?.length || 0) +
              (results.remisiones?.length || 0) +
              (results.productos?.length || 0) +
              (results.clientes?.length || 0);

            if (totalResults > 0) {
              setSearchResults(results);
              setIsResultsOpen(true);
            } else {
              setSearchResults(results); // Mostrar resultados vacíos
              setIsResultsOpen(true);
            }
          } else {
            setSearchResults(null);
            setIsResultsOpen(false);
          }
        } catch (error) {
          logger.error({ prefix: 'Header' }, 'Error en búsqueda global:', error);
          setSearchResults(null);
          setIsResultsOpen(false);
        }
      } else {
        setSearchResults(null);
        setIsResultsOpen(false);
      }
    };
    search();
  }, [debouncedSearchTerm, globalSearch]);

  const handleResultClick = (page: any, params: any) => {
    setPage(page, params);
    setSearchTerm('');
    setIsResultsOpen(false);
  };

  // ✅ Eliminados todos los useEffect de posicionamiento manual
  // Ahora usamos CSS puro con position: relative/absolute

  // ✅ ELIMINADO: useEffect que verificaba la bodega y causaba bucles infinitos
  // La verificación de bodega se hace ahora solo en AuthContext al seleccionar
  // No necesitamos verificar aquí porque switchSede ya maneja la validación

  // ✅ Eliminado el useEffect monstruo
  // Ahora usamos los custom hooks useClickOutside y useEscapeKey (ver arriba)

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3 md:py-4 bg-white/90 dark:bg-slate-800/90 supports-[backdrop-filter]:backdrop-blur border-b border-slate-200 dark:border-slate-700">
      {/* Left Section: Menu, Company, Search */}
      <div className="flex items-center min-w-0 flex-1 gap-2 sm:gap-3 md:gap-4">
        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-slate-500 dark:text-slate-200 focus:outline-none hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Abrir menú"
        >
          <i className="fas fa-bars fa-lg"></i>
        </button>

        {/* Company Name */}
        {selectedCompany && (
          <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 ml-2 md:ml-0 mr-2 md:mr-4 hidden md:block truncate max-w-[120px] lg:max-w-[150px]" title={selectedCompany?.razonSocial || ''}>
            {selectedCompany?.razonSocial || 'Sin empresa'}
          </h1>
        )}

        {/* --- Global Search Bar --- */}
        <div className="relative flex-1 min-w-0 max-w-[400px] md:max-w-[500px] lg:max-w-[600px]" ref={searchRef}>
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 z-10"></i>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => { if (searchResults) setIsResultsOpen(true); }}
            placeholder="Buscar documentos, clientes, productos..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm hover:shadow-md"
          />
          {isResultsOpen && searchResults && (
            <GlobalSearchResults
              results={searchResults}
              onResultClick={handleResultClick}
              onClose={() => setIsResultsOpen(false)}
            />
          )}
        </div>
        {/* Mobile search toggler - solo visible en móvil cuando la búsqueda está cerrada */}
        {!isMobileSearchOpen && (
          <button
            className="md:hidden ml-2 text-slate-500 dark:text-slate-200 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
            onClick={() => setIsMobileSearchOpen((v) => !v)}
            aria-label="Buscar"
          >
            <i className="fas fa-search text-lg"></i>
          </button>
        )}
        {isMobileSearchOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 px-4 md:hidden z-30" ref={searchRef}>
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => { if (searchResults) setIsResultsOpen(true); }}
                placeholder="Buscar documentos, clientes, productos..."
                className="w-full pl-10 pr-10 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" onClick={() => { setIsMobileSearchOpen(false); setIsResultsOpen(false); }} aria-label="Cerrar búsqueda">
                <i className="fas fa-times"></i>
              </button>
              {isResultsOpen && searchResults && (
                <GlobalSearchResults
                  results={searchResults}
                  onResultClick={(p, params) => { handleResultClick(p, params); setIsMobileSearchOpen(false); }}
                  onClose={() => setIsResultsOpen(false)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Section: Warehouse, Notifications, User - Professional Layout */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-shrink-0 ml-2 md:ml-4">
        {/* Bodega Selector - Desktop only, positioned before notifications */}
        <div className="relative hidden lg:block z-50" ref={bodegasDropdownRef}>
          <button
            id="sede-chip"
            className={`inline-flex items-center gap-2 pl-3 pr-2 py-2 text-sm bg-white dark:bg-slate-800 border rounded-lg transition-all max-w-[200px] focus:outline-none ${isSedePopoverOpen
                ? 'border-blue-500 shadow-md bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 hover:shadow-sm'
              } ${isLoadingBodegasLocal ? 'opacity-50 cursor-wait' : ''}`}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();

              const willBeOpen = !isSedePopoverOpen;
              setIsSedePopoverOpen(willBeOpen);

              if (willBeOpen) {
                setIsLoadingBodegasLocal(true);
                setBodegasDisponibles([]);

                try {
                  let response;
                  try {
                    response = await fetchBodegas();
                  } catch (fetchError) {
                    logger.warn({ prefix: 'Header' }, 'Error de red al cargar bodegas:', fetchError);
                    setBodegasDisponibles([]);
                    setIsLoadingBodegasLocal(false);
                    return;
                  }

                  if (!response || !response.success || !response.data || !Array.isArray(response.data) || response.data.length === 0) {
                    logger.warn({ prefix: 'Header' }, 'No se pudieron cargar bodegas desde la BD');
                    setBodegasDisponibles([]);
                    setIsLoadingBodegasLocal(false);
                    return;
                  }

                  const extractArrayData = (response: any): any[] => {
                    if (!response.success) return [];
                    const raw = response.data;
                    if (Array.isArray(raw)) return raw;
                    if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as any).data)) {
                      return (raw as any).data;
                    }
                    if (raw && typeof raw === 'object' && 'items' in raw && Array.isArray((raw as any).items)) {
                      return (raw as any).items;
                    }
                    return [];
                  };

                  const bodegasData = extractArrayData(response);

                  if (bodegasData.length > 0) {
                    // El backend ahora devuelve: id (codalm), codigo (codalm), nombre (nomalm), direccion (diralm), ciudad (ciualm)
                    const mappedBodegas = bodegasData.map((b: any, index: number) => {
                      const nombreBodega = (b.nombre || b.nomalm || '').trim() || `Bodega ${index + 1}`;
                      const codigoAlmacen = String(b.codigo || b.codalm || b.id || '').trim();

                      // Convertir código a número para el ID si es posible
                      let bodegaId: number;
                      if (codigoAlmacen && /^\d+$/.test(codigoAlmacen)) {
                        bodegaId = parseInt(codigoAlmacen, 10);
                      } else {
                        bodegaId = index + 1;
                      }

                      // Usar el código directamente de la BD (ya viene formateado)
                      const bodegaCodigo = codigoAlmacen.padStart(3, '0');

                      return {
                        id: bodegaId,
                        nombre: nombreBodega,
                        codigo: bodegaCodigo,
                        empresaId: selectedCompany?.id || 1,
                        municipioId: 11001,
                        direccion: (b.direccion || b.diralm || '').trim(),
                        ciudad: (b.ciudad || b.ciualm || '').trim()
                      };
                    });

                    // Ordenar bodegas por código (001, 002, 003, etc.)
                    const bodegasOrdenadas = [...mappedBodegas].sort((a, b) => {
                      const codigoA = String(a.codigo || '').padStart(3, '0');
                      const codigoB = String(b.codigo || '').padStart(3, '0');
                      return codigoA.localeCompare(codigoB);
                    });

                    logger.log({ prefix: 'Header', level: 'debug' }, 'Bodegas mapeadas y ordenadas por código:', bodegasOrdenadas.map(b => ({
                      nombre: b.nombre,
                      codigo: b.codigo,
                      id: b.id
                    })));
                    setBodegasDisponibles(bodegasOrdenadas);
                  } else {
                    setBodegasDisponibles([]);
                  }
                } catch (error) {
                  logger.error({ prefix: 'Header' }, 'Error cargando bodegas:', error);
                  setBodegasDisponibles([]);
                } finally {
                  setIsLoadingBodegasLocal(false);
                }
              } else {
                setBodegasDisponibles([]);
              }
            }}
            aria-haspopup="listbox"
            aria-expanded={isSedePopoverOpen}
            title={selectedSede?.nombre || 'Seleccionar bodega'}
            disabled={isLoadingBodegasLocal}
          >
            {isLoadingBodegasLocal ? (
              <i className="fas fa-spinner fa-spin text-xs text-slate-500 flex-shrink-0"></i>
            ) : (
              <i className="fas fa-warehouse text-xs text-slate-500 flex-shrink-0"></i>
            )}
            <span className="truncate max-w-[140px] text-slate-700 dark:text-slate-200 font-medium">
              {isLoadingBodegasLocal ? 'Cargando...' : (
                selectedSede ? (
                  <>
                    {/* ✅ 100% DINÁMICO - Lee del estado selectedSede */}
                    {selectedSede.nombre || 'Sin nombre'}
                    {selectedSede.codigo && (
                      <span className="ml-1 text-xs text-slate-500">({selectedSede.codigo})</span>
                    )}
                  </>
                ) : (
                  'Seleccionar bodega'
                )
              )}
            </span>
            <i className={`fas fa-chevron-${isSedePopoverOpen ? 'up' : 'down'} text-xs text-slate-500 transition-transform flex-shrink-0`}></i>
          </button>
          {/* Dropdown Menu - CSS puro con position: absolute */}
          {isSedePopoverOpen && (
            <div
              id="sede-popover"
              ref={bodegasPopoverRef}
              className="absolute top-full left-0 mt-2 w-[280px] max-h-72 overflow-auto no-scrollbar rounded-md border-2 border-blue-500 bg-white dark:bg-slate-800 shadow-2xl z-50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Bodegas Disponibles</p>
              </div>

              {/* Loading State */}
              {isLoadingBodegasLocal && (
                <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  <i className="fas fa-spinner fa-spin mb-2"></i>
                  <p>Cargando bodegas desde la API...</p>
                </div>
              )}

              {/* Empty State - Sin datos */}
              {!isLoadingBodegasLocal && bodegasDisponibles.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  <i className="fas fa-exclamation-triangle mb-2"></i>
                  <p>No hay bodegas disponibles</p>
                  <p className="text-xs mt-1">Verifica la conexión con la base de datos</p>
                </div>
              )}

              {/* Lista de Bodegas - Solo mostrar si hay datos y no está cargando */}
              {!isLoadingBodegasLocal && bodegasDisponibles.length > 0 && (
                <ul role="listbox" className="py-2 text-sm">
                  {bodegasDisponibles.map((sede, index) => {
                    // Verificar si esta bodega está seleccionada - USAR SOLO ID para evitar múltiples selecciones
                    // Primero intentar por ID (más confiable), luego por código si no hay ID
                    const isSelected = selectedSede?.id && sede.id
                      ? selectedSede.id === sede.id
                      : selectedSede?.codigo && sede.codigo
                        ? String(selectedSede.codigo).trim() === String(sede.codigo).trim()
                        : false;

                    return (
                      <li key={`bodega-${sede.id || sede.codigo || index}-${index}`}>
                        <button
                          className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2 ${isSelected
                              ? 'font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                              : 'text-slate-700 dark:text-slate-300'
                            }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            logger.log({ prefix: 'Header', level: 'debug' }, 'Click en bodega:', {
                              id: sede.id,
                              codigo: sede.codigo,
                              nombre: sede.nombre
                            });

                            // Cerrar el dropdown inmediatamente
                            setIsSedePopoverOpen(false);

                            // ✅ SOLUCIÓN: Siempre pasar código y nombre, usar código como ID si es necesario
                            // Priorizar código sobre ID para la búsqueda
                            const sedeId = sede?.id !== undefined ? sede.id : (sede?.codigo || '');

                            // Solo cambiar si es diferente a la bodega actualmente seleccionada
                            if (selectedSede &&
                              (selectedSede.id === sedeId ||
                                (selectedSede.codigo && sede.codigo && String(selectedSede.codigo).trim() === String(sede.codigo).trim()))) {
                              logger.log({ prefix: 'Header', level: 'debug' }, 'Bodega ya seleccionada, omitiendo cambio:', sede.nombre);
                              setIsSedePopoverOpen(false);
                              return; // Ya está seleccionada, no hacer nada
                            }

                            logger.log({ prefix: 'Header', level: 'debug' }, 'Cambiando bodega:', {
                              nombre: sede.nombre,
                              id: sedeId,
                              codigo: sede.codigo,
                              tipoId: typeof sedeId
                            });

                            // Siempre pasar código y nombre para asegurar búsqueda exitosa
                            switchSede(sedeId, {
                              codigo: sede.codigo || String(sede.id).padStart(3, '0'),
                              nombre: sede.nombre
                            });

                            // El popover ya se cierra arriba con setIsSedePopoverOpen(false)
                          }}
                        >
                          <i className={`fas fa-warehouse text-xs ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}></i>
                          <span className="flex-1 font-medium">{sede.nombre || 'Sin nombre'}</span>
                          {sede.codigo && (
                            <span className="text-xs text-slate-400">({sede.codigo})</span>
                          )}
                          {isSelected && (
                            <i className="fas fa-check text-blue-600 dark:text-blue-400 text-xs"></i>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* More menu (mobile) - Para bodega y empresa en móvil */}
        <div className="lg:hidden relative" ref={moreMenuRef}>
          <button
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Más opciones"
            onClick={() => setIsMoreMenuOpen(v => !v)}
          >
            <i className="fas fa-ellipsis-h text-slate-600 dark:text-slate-300"></i>
          </button>
          {isMoreMenuOpen && (
            <div
              ref={moreMenuPopoverRef}
              className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg p-3 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Empresa</label>
                <div className="relative">
                  <select
                    value={selectedCompany?.id || ''}
                    onChange={(e) => { switchCompany(Number(e.target.value)); setIsMoreMenuOpen(false); }}
                    className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(user?.empresas || []).map(empresa => (
                      <option key={empresa?.id || ''} value={empresa?.id || ''}>
                        {empresa?.razonSocial || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none"></i>
                </div>
              </div>
              {selectedCompany && (
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <i className="fas fa-warehouse mr-1"></i>Bodega
                  </label>
                  <div className="relative">
                    <select
                      value={selectedSede?.id || ''}
                      onChange={(e) => {
                        const sedeId = Number(e.target.value);
                        const sedeSeleccionada = selectedCompany?.sedes?.find(s => s.id === sedeId);
                        if (sedeSeleccionada) {
                          switchSede(sedeId, {
                            codigo: sedeSeleccionada.codigo,
                            nombre: sedeSeleccionada.nombre
                          });
                        } else {
                          switchSede(sedeId);
                        }
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full pl-3 pr-8 py-2 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!selectedCompany?.sedes || selectedCompany.sedes.length === 0}
                    >
                      {(selectedCompany?.sedes && selectedCompany.sedes.length > 0) ? (
                        [...selectedCompany.sedes]
                          .sort((a, b) => {
                            const codigoA = String(a?.codigo || '').padStart(3, '0');
                            const codigoB = String(b?.codigo || '').padStart(3, '0');
                            return codigoA.localeCompare(codigoB);
                          })
                          .map(sede => (
                            <option key={sede?.id || ''} value={sede?.id || ''}>
                              {sede?.nombre || 'Sin nombre'}
                            </option>
                          ))
                      ) : (
                        <option value="">No hay bodegas disponibles</option>
                      )}
                    </select>
                    <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none"></i>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications Bell - Professional position */}
        <div className="relative flex-shrink-0" ref={notificationRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setNotificationDropdownOpen(prev => !prev);
            }}
            className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative group"
            aria-label="Ver notificaciones"
            aria-expanded={notificationDropdownOpen}
          >
            <i className="fas fa-bell text-lg text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-100 transition-colors"></i>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 block h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notificationDropdownOpen && (
            <div
              ref={notificationPopoverRef}
              className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-700">
                <h4 className="font-semibold text-slate-800 dark:text-slate-100">Notificaciones</h4>
                {notifications.some(n => !n.isRead) && (
                  <button onClick={markAllAsRead} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                    Marcar todas como leídas
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {notifications.length > 0 ? (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => { handleNotificationClick(n); setNotificationDropdownOpen(false); }}
                      className={`p-3 flex items-start gap-3 cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50 ${!n.isRead ? 'bg-blue-50 dark:bg-slate-900/50' : ''}`}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex-shrink-0 pt-1">
                        {n.type === 'success' && <i className="fas fa-check-circle text-green-500 w-5 h-5"></i>}
                        {n.type === 'warning' && <i className="fas fa-exclamation-triangle text-yellow-500 w-5 h-5"></i>}
                        {n.type === 'info' && <i className="fas fa-info-circle text-blue-500 w-5 h-5"></i>}
                        {!n.type && <i className="fas fa-bell text-slate-500 w-5 h-5"></i>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{n.message}</p>
                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">{new Date(n.timestamp).toLocaleString('es-CO')}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center p-8 text-sm text-slate-500 dark:text-slate-400">
                    <i className="fas fa-check-circle fa-2x mb-2 text-slate-300 dark:text-slate-600"></i>
                    <p>Estás al día</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Dropdown - Professional position */}
        <div className="relative flex-shrink-0" ref={userDropdownRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setUserDropdownOpen(!userDropdownOpen);
            }}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
            aria-label="Menú de usuario"
            aria-expanded={userDropdownOpen}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-sm ring-2 ring-blue-100 dark:ring-blue-900/50">
              {(user?.nombre && String(user.nombre).charAt(0)?.toUpperCase()) || 'U'}
            </div>
            <div className="text-left hidden md:block min-w-0">
              <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate max-w-[120px]">{user?.nombre || 'Usuario'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]">{user?.rol || 'Rol'}</p>
            </div>
            <i className={`fas fa-chevron-${userDropdownOpen ? 'up' : 'down'} text-xs text-slate-400 dark:text-slate-500 hidden md:block group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors`}></i>
          </button>
          {userDropdownOpen && (
            <div
              ref={userPopoverRef}
              className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{user?.nombre || 'Usuario'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || user?.rol || 'Sin información'}</p>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setUserDropdownOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-3"
              >
                <i className="fas fa-sign-out-alt fa-fw text-slate-400 dark:text-slate-500"></i>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;