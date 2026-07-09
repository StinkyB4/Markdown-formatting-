package church.osbornevillage.pastepretty;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the native rich-clipboard bridge before the WebView loads so
        // the copy button can put genuine formatted HTML on the system clipboard.
        registerPlugin(RichClipboardPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
