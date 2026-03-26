import React, { useState, useEffect } from 'react';
import type { Notification, NotificationCategory, NotificationPriority } from '../services/notifications/types';
import { notificationManager } from '../services/notifications';

interface NotificationHistoryProps {
  userId: string;
  maxItems?: number;
}

export function NotificationHistory({ userId, maxItems = 50 }: NotificationHistoryProps): JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<NotificationPriority | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  useEffect(() => {
    filterNotifications();
  }, [notifications, selectedCategory, selectedPriority, searchTerm, showUnreadOnly]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const loaded = await notificationManager.getNotifications(maxItems);
      setNotifications(loaded);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterNotifications = () => {
    let filtered = [...notifications];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(n => n.category === selectedCategory);
    }

    if (selectedPriority !== 'all') {
      filtered = filtered.filter(n => n.priority === selectedPriority);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(term) || 
        n.message.toLowerCase().includes(term)
      );
    }

    if (showUnreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }

    setFilteredNotifications(filtered);
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationManager.markAsRead(id);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      for (const notification of notifications) {
        if (!notification.read) {
          await notificationManager.markAsRead(notification.id);
        }
      }
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await notificationManager.deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      for (const notification of notifications) {
        await notificationManager.deleteNotification(notification.id);
      }
      setNotifications([]);
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  };

  const getCategoryColor = (category: NotificationCategory) => {
    const colors = {
      transaction: 'var(--color-accent)',
      escrow: 'var(--color-warning)',
      system: 'var(--color-text-muted)',
      security: 'var(--color-error)',
      marketing: 'var(--color-success)',
      general: 'var(--color-text-secondary)',
    };
    return colors[category] || 'var(--color-text-muted)';
  };

  const getPriorityColor = (priority: NotificationPriority) => {
    const colors = {
      critical: 'var(--color-error)',
      high: 'var(--color-warning)',
      medium: 'var(--color-accent)',
      low: 'var(--color-text-muted)',
    };
    return colors[priority] || 'var(--color-text-muted)';
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <div>Loading notifications...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Notification History</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={markAllAsRead}
            disabled={notifications.every(n => n.read)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: notifications.every(n => n.read) ? 'var(--color-bg-tertiary)' : 'var(--color-accent)',
              color: notifications.every(n => n.read) ? 'var(--color-text-muted)' : 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: notifications.every(n => n.read) ? 'default' : 'pointer',
            }}
          >
            Mark All Read
          </button>
          <button
            onClick={clearAllNotifications}
            disabled={notifications.length === 0}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: notifications.length === 0 ? 'var(--color-bg-tertiary)' : 'var(--color-error)',
              color: notifications.length === 0 ? 'var(--color-text-muted)' : 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: notifications.length === 0 ? 'default' : 'pointer',
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '8px', 
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: 'var(--color-bg-tertiary)',
        borderRadius: '4px'
      }}>
        <input
          type="text"
          placeholder="Search notifications..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '6px',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            fontSize: '12px',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
          }}
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as NotificationCategory | 'all')}
          style={{
            padding: '6px',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            fontSize: '12px',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="all">All Categories</option>
          <option value="transaction">Transaction</option>
          <option value="escrow">Escrow</option>
          <option value="system">System</option>
          <option value="security">Security</option>
          <option value="marketing">Marketing</option>
          <option value="general">General</option>
        </select>

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value as NotificationPriority | 'all')}
          style={{
            padding: '6px',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            fontSize: '12px',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
          />
          Unread only
        </label>
      </div>

      {/* Notification List */}
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {filteredNotifications.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: 'var(--color-text-muted)', 
            fontSize: '14px' 
          }}>
            {notifications.length === 0 ? 'No notifications yet' : 'No notifications match your filters'}
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <div
              key={notification.id}
              style={{
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: notification.read ? 'var(--color-bg-primary)' : 'var(--color-bg-tertiary)',
                border: `1px solid ${notification.read ? 'var(--color-border)' : getPriorityColor(notification.priority)}`,
                borderRadius: '4px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: getPriorityColor(notification.priority),
                      }}
                    />
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        backgroundColor: getCategoryColor(notification.category),
                        color: 'white',
                        borderRadius: '2px',
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {notification.category}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {notification.title}
                    </span>
                  </div>
                  
                  <p style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '13px', 
                    color: 'var(--color-text-secondary)',
                    lineHeight: '1.4'
                  }}>
                    {notification.message}
                  </p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {formatTimestamp(notification.timestamp)}
                    </span>
                    
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            backgroundColor: 'var(--color-accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer',
                          }}
                        >
                          Mark Read
                        </button>
                      )}
                      
                      {notification.actionUrl && (
                        <button
                          onClick={() => {
                            window.open(notification.actionUrl, '_blank');
                            markAsRead(notification.id);
                          }}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            backgroundColor: 'var(--color-success)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer',
                          }}
                        >
                          {notification.actionText || 'Open'}
                        </button>
                      )}
                      
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        style={{
                          padding: '2px 6px',
                          fontSize: '10px',
                          backgroundColor: 'var(--color-error)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '2px',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {!notification.read && (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: getPriorityColor(notification.priority),
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Summary */}
      <div style={{ 
        marginTop: '16px', 
        padding: '8px', 
        backgroundColor: 'var(--color-bg-tertiary)', 
        borderRadius: '4px',
        fontSize: '11px',
        color: 'var(--color-text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          Showing {filteredNotifications.length} of {notifications.length} notifications
        </span>
        <span>
          {notifications.filter(n => !n.read).length} unread
        </span>
      </div>
    </div>
  );
}
