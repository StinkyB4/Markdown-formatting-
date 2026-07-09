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
 * Markdown fallback.
 */
@CapacitorPlugin(name = "RichClipboard")
public class RichClipboardPlugin extends Plugin {

    @PluginMethod
    public void copyHtml(PluginCall call) {
        String html = call.getString("html", "");
        String plain = call.getString("plain", "");

        Context ctx = getContext();
        ClipboardManager cm =
            (ClipboardManager) ctx.getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm == null) {
            call.reject("The clipboard is unavailable on this device.");
            return;
        }

        try {
            ClipData clip = ClipData.newHtmlText("Paste Pretty", plain, html);
            cm.setPrimaryClip(clip);
        } catch (Exception e) {
            call.reject("The clipboard refused the formatted text.", e);
            return;
        }

        JSObject ret = new JSObject();
        ret.put("copied", true);
        call.resolve(ret);
    }
}
