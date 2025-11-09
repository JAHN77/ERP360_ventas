import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Permission } from '../../config/rolesConfig';

interface ProtectedComponentProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const ProtectedComponent: React.FC<ProtectedComponentProps> = ({ permission, children, fallback = null }) => {
  const { hasPermission } = useAuth();

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export default ProtectedComponent;