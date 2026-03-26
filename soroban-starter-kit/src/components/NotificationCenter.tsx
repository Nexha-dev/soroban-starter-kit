import React, { useState, useEffect } from 'react';
import { Notification } from '../services/notifications/types';
import { notificationManager } from '../services/notifications';

interface NotificationCenterProps {
  notifications?: Notification[];
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationCenter({ notifications: initialNotifications, onNotificationClick }: NotificationCenterProps): JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications || []);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const loaded = await notificationManager.getNotifications(20);
    setNotifications(loaded);
  };

  const handleNotificationClick = async (notification: Notification) => {
    await notificationManager.markAsRead(notification.id);
    await notificationManager.recordAnalytics(notification.id, 'clicked', 'in-app');
    setNotifications(notifications.map(n => n.id === notification.id ? { ...n, read: true } : n));
    onNotificationClick?.(notification);
  };

  const handleDelete = async (id: string) => {
    await notificationManager.deleteNotification(id);
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'var(--color-error)';
      case 'high': return 'var(--color-warning)';
      case 'medium': return 'var(--color-accent)';
      default: return 'var(--color-text-muted)';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          padding: '8px 12px',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '18px',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            backgroundColor: 'var(--color-error)',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          width: '350px',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1000,
          maxHeight: '500px',
          overflowY: 'auto',
        }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Notifications</h3>
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
              No notifications
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: notification.read ? 'transparent' : 'var(--color-bg-tertiary)',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = notification.read ? 'transparent' : 'var(--color-bg-tertiary)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => handleNotificationClick(notification)}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                    }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: getPriorityColor(notification.priority),
                      }} />
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{notification.title}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {notification.message}
                    </p>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {new Date(notification.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(notification.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
