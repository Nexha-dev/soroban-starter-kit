import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TokenScreen } from './screens/TokenScreen';
import { EscrowScreen } from './screens/EscrowScreen';
import { QueueScreen } from './screens/QueueScreen';
import { ExportScreen } from './screens/ExportScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { theme } from './theme';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: theme.colors.surface,
                borderTopColor: theme.colors.border,
                height: 60,
              },
              tabBarActiveTintColor: theme.colors.primary,
              tabBarInactiveTintColor: theme.colors.textMuted,
              tabBarLabelStyle: { fontSize: theme.fontSize.xs, marginBottom: 4 },
              // Ensure touch targets are large enough
              tabBarItemStyle: { minHeight: theme.touchTarget },
            }}
          >
            <Tab.Screen
              name="Token"
              component={TokenScreen}
              options={{
                tabBarLabel: 'Token',
                tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🪙</Text>,
                tabBarAccessibilityLabel: 'Token screen',
              }}
            />
            <Tab.Screen
              name="Escrow"
              component={EscrowScreen}
              options={{
                tabBarLabel: 'Escrow',
                tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔒</Text>,
                tabBarAccessibilityLabel: 'Escrow screen',
              }}
            />
            <Tab.Screen
              name="Queue"
              component={QueueScreen}
              options={{
                tabBarLabel: 'Queue',
                tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text>,
                tabBarAccessibilityLabel: 'Offline queue screen',
              }}
            />
            <Tab.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{
                tabBarLabel: 'Dashboard',
                tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
                tabBarAccessibilityLabel: 'Dashboard screen',
              }}
            />
            <Tab.Screen
              name="Export"
              component={ExportScreen}
              options={{
                tabBarLabel: 'Export',
                tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📤</Text>,
                tabBarAccessibilityLabel: 'Export screen',
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
