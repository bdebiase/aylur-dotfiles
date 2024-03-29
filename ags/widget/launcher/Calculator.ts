import options from "options"
import icons from "lib/icons"

import * as math from "mathjs"

const { iconSize } = options.launcher.apps

const AnswerItem = (a: string) => {
    const title = Widget.Label({
        class_name: "title",
        label: "Answer",
        hexpand: true,
        xalign: 0,
        vpack: "center",
        truncate: "end",
    })

    const description = Widget.Label({
        class_name: "description",
        label: a,
        hexpand: true,
        wrap: true,
        max_width_chars: 30,
        xalign: 0,
        justification: "left",
        vpack: "center",
    })

    const appicon = Widget.Icon({
        icon: icons.app.calculator,
        size: iconSize.bind(),
    })

    const textBox = Widget.Box({
        vertical: true,
        vpack: "center",
        children: [title, description],
    })

    return Widget.Button({
        class_name: "app-item",
        child: Widget.Box({
            children: [appicon, textBox],
        }),
        on_clicked: () => {
            App.closeWindow("launcher")
            print("ANSWER!!!!")
        },
    })
}
export function Calculator() {
    const revealer = Widget.Revealer({
        child: AnswerItem(""),
    })

    let answer = ""

    function updateResult(expression: string) {
        try {
            const result = math.evaluate(expression.replace(/\s/g, "")).toString()
            revealer.reveal_child = true
            revealer.child.child.children[1].children[1].label = expression + " = " + result
            answer = result
        } catch (e) {
            print(e)
            revealer.reveal_child = false
        }
    }

    function getAnswer() {
        return answer
    }

    return Object.assign(revealer, {
        updateResult,
        getAnswer,
    })
}
