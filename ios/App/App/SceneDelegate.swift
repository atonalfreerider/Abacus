import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        // Launched from a home-screen quick action: the web app reads it as its launch URL.
        if let item = connectionOptions.shortcutItem { _ = open(shortcut: item) }
    }

    // Home-screen quick actions (a firm 3D Touch press or a long press on the icon) open
    // abacus://open/<place>, which the web app routes like an Android app shortcut.
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(open(shortcut: shortcutItem))
    }

    private func open(shortcut: UIApplicationShortcutItem) -> Bool {
        guard let place = shortcut.type.split(separator: ".").last, let url = URL(string: "abacus://open/\(place)") else { return false }
        return ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
