import React from 'react';
import {Pressable, StatusBar, StyleSheet, Text} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AuthProvider, useAuth} from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import CategoryScreen from './src/screens/CategoryScreen';
import GameScreen from './src/screens/GameScreen';
import ResultScreen from './src/screens/ResultScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import {colors} from './src/theme';
import type {RootStackParamList} from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function HeaderGear({onPress}: {onPress: () => void}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.gear}>
      <Text style={styles.gearText}>⚙️</Text>
    </Pressable>
  );
}

function Navigator() {
  const {user, loading} = useAuth();

  if (loading) {
    return (
      <Text style={styles.splash}>Loading…</Text>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.backgroundAlt},
        headerTintColor: colors.gold,
        headerTitleStyle: {fontWeight: '700'},
        contentStyle: {backgroundColor: colors.background},
      }}>
      {user ? (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={({navigation}) => ({
              title: 'Millionaire',
              // Header buttons are render props by React Navigation design.
              // eslint-disable-next-line react/no-unstable-nested-components
              headerRight: () => (
                <HeaderGear
                  onPress={() => navigation.navigate('Settings')}
                />
              ),
            })}
          />
          <Stack.Screen
            name="Category"
            component={CategoryScreen}
            options={{title: 'Select Category'}}
          />
          <Stack.Screen
            name="Game"
            component={GameScreen}
            options={{title: 'Game', headerBackVisible: false}}
          />
          <Stack.Screen
            name="Result"
            component={ResultScreen}
            options={{title: 'Result', headerBackVisible: false}}
          />
          <Stack.Screen
            name="Leaderboard"
            component={LeaderboardScreen}
            options={{title: 'Leaderboard'}}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{title: 'Profile'}}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{title: 'Server Settings'}}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{title: 'Create Account'}}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{title: 'Server Settings'}}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <NavigationContainer>
          <Navigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: colors.gold,
    fontSize: 18,
    backgroundColor: colors.background,
  },
  gear: {
    paddingHorizontal: 4,
  },
  gearText: {
    fontSize: 20,
  },
});

export default App;
