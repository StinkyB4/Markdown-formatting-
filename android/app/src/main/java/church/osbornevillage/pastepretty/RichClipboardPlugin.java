package church.osbornevillage.pastepretty;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * RichClipboard — the native half of the copy button.
 *
 * The Android WebView will not put a text/html flavor on the system clipboard
 * from JavaScript: both navigator.clipboard.write() and a synthetic copy event
 * with clipboardData.setData('text/html', …) silently deliver only text/plain,
 * so Word / Google Docs paste the raw Markdown. The only reliable way to land
 * genuine formatted HTML is to build the ClipData natively.
 *
 * ClipData.newHtmlText() stores BOTH representations at once: rich targets read
 * the HTML and get real formatting; plain targets read the text and get the
 * clean plain-text fallback.
 */
@CapacitorPlugin(name = "RichClipboard")
public class RichClipboardPlugin extends Plugin {

    @PluginMethod
    public void copyHtml(final PluginCall call) {
        final String html = call.getString("html", "");
        final String plain = call.getString("plain", "");
        final Context ctx = getContext();

        // setPrimaryClip() must run on a thread with a Looper. Capacitor may
        // dispatch plugin calls off the main thread, so hop to the UI thread.
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    ClipboardManager cm =
                        (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cm == null) {
                        call.reject("The clipboard is unavailable on this device.");
                        return;
                    }
                    ClipData clip = ClipData.newHtmlText("Paste Pretty", plain, html);
                    cm.setPrimaryClip(clip);

                    JSObject ret = new JSObject();
                    ret.put("copied", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("The clipboard refused the formatted text.", e);
                }
            }
        });
    }
}
