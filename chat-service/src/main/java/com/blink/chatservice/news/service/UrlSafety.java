package com.blink.chatservice.news.service;

import java.net.*;
import java.util.Locale;

final class UrlSafety {

    private UrlSafety() {}

    static boolean isSafePublicHttpUrl(URI uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme == null) return false;
        scheme = scheme.toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) return false;

        String host = uri.getHost();
        if (host == null || host.isBlank()) return false;

        // Disallow common local hostnames
        String lowerHost = host.toLowerCase(Locale.ROOT);
        if (lowerHost.equals("localhost") || lowerHost.endsWith(".localhost") || lowerHost.endsWith(".local")) {
            return false;
        }

        // Disallow explicit ports that aren't typical web ports (SSRF guard)
        int port = uri.getPort();
        if (port != -1 && port != 80 && port != 443) {
            return false;
        }

        try {
            InetAddress[] addrs = InetAddress.getAllByName(host);
            for (InetAddress addr : addrs) {
                if (addr.isAnyLocalAddress() || addr.isLoopbackAddress() || addr.isLinkLocalAddress()) return false;
                if (addr.isSiteLocalAddress()) return false; // 10/8, 172.16/12, 192.168/16

                String ip = addr.getHostAddress();
                if (ip != null) {
                    // IPv6 unique local addresses (fc00::/7) and link-local (fe80::/10)
                    if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return false;
                }
            }
        } catch (Exception e) {
            return false;
        }

        return true;
    }
}
