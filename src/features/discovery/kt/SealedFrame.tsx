import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { allowsLoad, sealed, SEALED_ORIGINS } from './Artifact';

export default function SealedFrame({ html, testID }: { html: string; testID?: string }) {
  const source = useMemo(() => ({ html: sealed(html), baseUrl: 'about:blank' }), [html]);
  return (
    <WebView
      source={source}
      originWhitelist={SEALED_ORIGINS}
      onShouldStartLoadWithRequest={(request: WebViewNavigation) => allowsLoad(request.url)}
      javaScriptEnabled
      domStorageEnabled={false}
      cacheEnabled={false}
      cacheMode="LOAD_NO_CACHE"
      thirdPartyCookiesEnabled={false}
      sharedCookiesEnabled={false}
      incognito={Platform.OS === 'ios'}
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      allowsLinkPreview={false}
      geolocationEnabled={false}
      javaScriptCanOpenWindowsAutomatically={false}
      setSupportMultipleWindows={false}
      mixedContentMode="never"
      mediaPlaybackRequiresUserAction
      webviewDebuggingEnabled={false}
      textZoom={100}
      testID={testID}
      style={styles.frame}
    />
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: 'transparent' },
});
